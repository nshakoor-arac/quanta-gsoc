import type { Baseline } from "../types";
import { BY_ISO3 } from "../geo/countries";
import { getStore } from "../store";
import { fetchJson } from "./http";

/** World Bank Worldwide Governance Indicators, governance score scale 0 to 100 (higher is better). */
export const WGI = [
  { code: "GOV_WGI_PV.SC", key: "PV", label: "Political stability and absence of violence" },
  { code: "GOV_WGI_GE.SC", key: "GE", label: "Government effectiveness" },
  { code: "GOV_WGI_RL.SC", key: "RL", label: "Rule of law" },
  { code: "GOV_WGI_CC.SC", key: "CC", label: "Control of corruption" },
  { code: "GOV_WGI_RQ.SC", key: "RQ", label: "Regulatory quality" },
  { code: "GOV_WGI_VA.SC", key: "VA", label: "Voice and accountability" },
] as const;

export type WgiTable = Record<string, Record<string, { value: number; year: string }>>; // iso2 -> key -> value

interface WbRow {
  countryiso3code?: string;
  country?: { id: string };
  date: string;
  value: number | null;
}

async function fetchIndicator(code: string): Promise<Record<string, { value: number; year: string }>> {
  const url = `https://api.worldbank.org/v2/country/all/indicator/${code}?format=json&mrv=1&source=3&per_page=400`;
  const json = await fetchJson<[unknown, WbRow[]]>(url, { timeoutMs: 20000 });
  const rows = json?.[1] ?? [];
  const out: Record<string, { value: number; year: string }> = {};
  for (const r of rows) {
    if (r.value == null) continue;
    const iso2 = r.countryiso3code ? BY_ISO3[r.countryiso3code]?.iso2 : undefined;
    if (!iso2) continue;
    out[iso2] = { value: Number(r.value), year: String(r.date) };
  }
  return out;
}

let memo: { at: number; table: WgiTable } | null = null;

/** All-country WGI table, cached in memory for 24h and in the store for 7 days. */
export async function wgiTable(): Promise<WgiTable | null> {
  if (memo && Date.now() - memo.at < 24 * 3600 * 1000) return memo.table;
  const store = getStore();
  const cached = await store.getCache<WgiTable>("wgi:v1");
  if (cached) {
    memo = { at: Date.now(), table: cached };
    return cached;
  }
  try {
    const results = await Promise.all(WGI.map((w) => fetchIndicator(w.code)));
    const table: WgiTable = {};
    WGI.forEach((w, i) => {
      for (const [iso2, v] of Object.entries(results[i])) {
        (table[iso2] ??= {})[w.key] = v;
      }
    });
    if (Object.keys(table).length < 50) return memo?.table ?? null;
    memo = { at: Date.now(), table };
    await store.setCache("wgi:v1", table, 7 * 24 * 3600);
    return table;
  } catch {
    return memo?.table ?? null;
  }
}

export async function baselinesFor(iso2s: string[]): Promise<Baseline[]> {
  const t = await wgiTable();
  if (!t) return [];
  const out: Baseline[] = [];
  let n = 1;
  for (const iso2 of iso2s) {
    const row = t[iso2];
    if (!row) continue;
    for (const w of WGI) {
      const v = row[w.key];
      if (!v) continue;
      out.push({ code: `B${n++}`, iso2, indicator: w.key, label: w.label, value: Math.round(v.value * 10) / 10, year: v.year, source: "World Bank, Worldwide Governance Indicators (governance score, 0 to 100)" });
    }
  }
  return out;
}
