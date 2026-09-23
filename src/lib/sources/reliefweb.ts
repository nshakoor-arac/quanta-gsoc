import type { Article } from "../types";
import { env } from "../env";
import { fetchJson } from "./http";
import { toArticle, type RawItem } from "./normalize";
import { BY_ISO3 } from "../geo/countries";

interface RWItem {
  id: string;
  fields: {
    title?: string;
    url?: string;
    url_alias?: string;
    date?: { created?: string; original?: string };
    source?: { name: string }[];
    country?: { name: string; iso3?: string }[];
    format?: { name: string }[];
    theme?: { name: string }[];
    disaster_type?: { name: string }[];
  };
}

export interface ReliefWebResult {
  ok: boolean;
  count: number;
  error?: string;
  articles: Article[];
}

/** Pulls latest ReliefWeb reports of all formats. Requires an approved appname (RELIEFWEB_APPNAME). */
export async function reliefwebLatest(opts: { limit?: number; iso3?: string } = {}): Promise<ReliefWebResult> {
  const appname = env.reliefwebAppname;
  if (!appname) return { ok: false, count: 0, error: "RELIEFWEB_APPNAME not set", articles: [] };
  try {
    const body: Record<string, unknown> = {
      limit: Math.min(opts.limit ?? 100, 200),
      sort: ["date.created:desc"],
      fields: { include: ["title", "url", "url_alias", "date.created", "date.original", "source.name", "country.name", "country.iso3", "format.name", "theme.name", "disaster_type.name"] },
    };
    if (opts.iso3) body.filter = { field: "country.iso3", value: opts.iso3.toLowerCase() };
    const json = await fetchJson<{ data?: RWItem[] }>(`https://api.reliefweb.int/v2/reports?appname=${encodeURIComponent(appname)}`, { method: "POST", body, timeoutMs: 20000 });
    const now = new Date();
    const out: Article[] = [];
    for (const it of json.data ?? []) {
      const f = it.fields;
      const url = f.url || f.url_alias || "";
      const known = (f.country ?? []).map((c) => (c.iso3 ? BY_ISO3[c.iso3.toUpperCase()]?.iso2 : undefined)).filter(Boolean) as string[];
      const fmt = f.format?.[0]?.name ?? "Report";
      const src = f.source?.[0]?.name ?? "ReliefWeb";
      const raw: RawItem = {
        url,
        title: f.title ?? "",
        excerpt: [fmt, (f.theme ?? []).map((t) => t.name).join(", "), (f.disaster_type ?? []).map((t) => t.name).join(", ")].filter(Boolean).join(" | "),
        published: f.date?.original || f.date?.created,
        aggregator: "reliefweb",
        feedId: "reliefweb",
        knownCountries: known,
        source: { name: `${src} via ReliefWeb`, domain: "reliefweb.int", type: "aggregator", band: "green", family: `rw:${src.toLowerCase().slice(0, 40)}` },
      };
      const a = toArticle(raw, now);
      if (a) out.push(a);
    }
    return { ok: true, count: out.length, articles: out };
  } catch (e) {
    return { ok: false, count: 0, error: (e as Error).message, articles: [] };
  }
}
