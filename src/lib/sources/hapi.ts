import type { Baseline } from "../types";
import { BY_ISO2 } from "../geo/countries";
import { env } from "../env";
import { fetchJson } from "./http";
import { getStore } from "../store";

type Row = Record<string, unknown>;

function text(v: unknown): string {
  return v == null ? "" : String(v);
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rowsOf(v: unknown): Row[] {
  if (Array.isArray(v)) return v.filter((x): x is Row => !!x && typeof x === "object");
  if (!v || typeof v !== "object") return [];
  const o = v as { data?: unknown; results?: unknown };
  if (Array.isArray(o.data)) return o.data as Row[];
  if (Array.isArray(o.results)) return o.results as Row[];
  return [];
}

function latestRows(items: Row[]): Row[] {
  if (!items.length) return [];
  const key = (r: Row) => text(r.reference_period_end || r.reference_period_start);
  const latest = items.map(key).filter(Boolean).sort().at(-1);
  return latest ? items.filter((r) => key(r) === latest) : items;
}

function nationalRows(items: Row[]): Row[] {
  const national = items.filter((r) => {
    const level = num(r.admin_level);
    return level === 0 || (!text(r.admin1_code) && !text(r.admin1_name));
  });
  return national.length ? national : items;
}

async function getRows(path: string, iso3: string): Promise<Row[]> {
  if (!env.hapiAppIdentifier) return [];
  const qs = new URLSearchParams({
    output_format: "json",
    location_code: iso3,
    limit: "500",
    offset: "0",
    app_identifier: env.hapiAppIdentifier,
  });
  const json = await fetchJson<unknown>(`https://hapi.humdata.org/api/v2/${path}?${qs.toString()}`, { timeoutMs: 16000 });
  return rowsOf(json);
}

function period(r: Row): string {
  return text(r.reference_period_end || r.reference_period_start || "latest");
}

async function countryHapi(iso2: string): Promise<Omit<Baseline, "code">[]> {
  const country = BY_ISO2[iso2];
  if (!country || !env.hapiAppIdentifier) return [];

  const store = getStore();
  const cacheKey = `hapi:v2:${country.iso3}`;
  const cached = await store.getCache<Omit<Baseline, "code">[]>(cacheKey);
  if (cached) return cached;

  const [conflictRaw, needsRaw, foodRaw] = await Promise.all([
    getRows("coordination-context/conflict-events", country.iso3).catch(() => []),
    getRows("affected-people/humanitarian-needs", country.iso3).catch(() => []),
    getRows("food-security-nutrition-poverty/food-security", country.iso3).catch(() => []),
  ]);

  const out: Omit<Baseline, "code">[] = [];

  // HAPI/ACLED categories are not mutually exclusive. Keep them separate.
  for (const r of latestRows(nationalRows(conflictRaw))) {
    const eventType = text(r.event_type);
    const events = num(r.events);
    const fatalities = num(r.fatalities);
    const key = eventType.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase();
    if (eventType && events != null) out.push({
      iso2,
      indicator: `HAPI_ACLED_${key}_EVENTS`,
      label: `ACLED ${eventType}: reported events`,
      value: events,
      year: period(r),
      source: "HDX HAPI / ACLED monthly conflict-event aggregation",
    });
    if (eventType && fatalities != null) out.push({
      iso2,
      indicator: `HAPI_ACLED_${key}_FATALITIES`,
      label: `ACLED ${eventType}: reported fatalities`,
      value: fatalities,
      year: period(r),
      source: "HDX HAPI / ACLED monthly conflict-event aggregation",
    });
  }

  // HAPI guidance says intersectoral PIN is the appropriate all-sector figure.
  const needs = latestRows(nationalRows(needsRaw)).filter((r) => text(r.population_status).toUpperCase() === "INN");
  const intersectoral = needs.filter((r) => /intersectoral/i.test(text(r.sector_name)));
  const pinPool = intersectoral.length ? intersectoral : needs;
  const pin = pinPool
    .map((r) => ({ r, v: num(r.population) }))
    .filter((x): x is { r: Row; v: number } => x.v != null)
    .sort((a, b) => b.v - a.v)[0];
  if (pin) out.push({
    iso2,
    indicator: "HAPI_PIN",
    label: "People in Need",
    value: pin.v,
    year: period(pin.r),
    source: "HDX HAPI / OCHA Humanitarian Programme Cycle",
  });

  // IPC/CH Phase 3+ is the population requiring urgent action.
  const food = latestRows(nationalRows(foodRaw)).filter((r) => {
    const p = text(r.ipc_phase).toLowerCase().replace(/\s/g, "");
    return p === "3+" || p === "phase3+";
  });
  const currentFood = food.filter((r) => text(r.ipc_type).toLowerCase() === "current");
  const foodPool = currentFood.length ? currentFood : food;
  const fs = foodPool
    .map((r) => ({ r, v: num(r.population_in_phase) }))
    .filter((x): x is { r: Row; v: number } => x.v != null)
    .sort((a, b) => b.v - a.v)[0];
  if (fs) out.push({
    iso2,
    indicator: "HAPI_IPC3PLUS",
    label: "Population in IPC/CH Phase 3+",
    value: fs.v,
    year: period(fs.r),
    source: "HDX HAPI / IPC acute food-insecurity analysis",
  });

  await store.setCache(cacheKey, out, 12 * 3600).catch(() => undefined);
  return out;
}

export async function hapiBaselinesFor(iso2s: string[]): Promise<Omit<Baseline, "code">[]> {
  if (!env.hapiAppIdentifier) return [];
  const groups = await Promise.all(iso2s.slice(0, 4).map((iso2) => countryHapi(iso2).catch(() => [])));
  return groups.flat();
}
