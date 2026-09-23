import type { Article } from "../types";
import { env } from "../env";
import { fetchText, sleep } from "./http";
import { toArticle, type RawItem } from "./normalize";
import { profileForDomain } from "./registry";
import { BY_ISO2, countriesInRegion } from "../geo/countries";
import { THEME_MAP } from "../taxonomy";
import type { ThemeId } from "../types";

interface GdeltArticle {
  url: string;
  title: string;
  seendate: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
}

const LANG_MAP: Record<string, string> = { english: "en", spanish: "es", french: "fr", arabic: "ar", russian: "ru", portuguese: "pt", german: "de", chinese: "zh", turkish: "tr", persian: "fa" };

/** GDELT allows roughly one request per five seconds per client. Serialise calls within an instance. */
let lastCall = 0;
let chain: Promise<unknown> = Promise.resolve();
async function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    const wait = Math.max(0, lastCall + 5200 - Date.now());
    if (wait) await sleep(wait);
    try {
      return await fn();
    } finally {
      lastCall = Date.now();
    }
  };
  const p = chain.then(run, run);
  chain = p.catch(() => undefined);
  return p;
}

function parseSeen(s: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s || "");
  if (!m) return new Date().toISOString();
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])).toISOString();
}

const AMBIGUOUS_QUERY: Record<string, string> = {
  GE: '("Republic of Georgia" OR Tbilisi OR "Georgian government")',
  JO: '("Jordan" (Amman OR Jordanian OR "Kingdom of Jordan"))',
  TD: '(Chad (Chadian OR "N\'Djamena" OR Sahel))',
  NE: '(Niger (Niamey OR Nigerien OR Sahel))',
  CD: '("DR Congo" OR "Democratic Republic of Congo" OR "Congo" (Kinshasa OR Goma OR M23))',
  PS: '(Gaza OR "West Bank" OR Palestinian)',
  US: '("United States" OR Washington OR Pentagon)',
  GB: '("United Kingdom" OR Britain OR London)',
};

export function gdeltCountryQuery(iso2: string): string {
  if (AMBIGUOUS_QUERY[iso2]) return AMBIGUOUS_QUERY[iso2];
  const c = BY_ISO2[iso2];
  return c ? `"${c.name}"` : "";
}

const REGION_WATCH: Record<string, string[]> = {
  "Sub-Saharan Africa": ["SD", "SS", "ET", "SO", "CD", "NG", "ML", "BF", "NE", "MZ", "CM", "KE"],
  "Middle East & North Africa": ["PS", "IL", "LB", "SY", "YE", "IR", "IQ", "LY", "EG", "SA", "TR"],
  Europe: ["UA", "RU", "BY", "MD", "RS", "XK"],
  "Central Asia & Caucasus": ["AM", "AZ", "GE", "KZ", "UZ", "TJ", "KG"],
  "South Asia": ["AF", "PK", "IN", "BD", "LK", "NP"],
  "East & Southeast Asia": ["CN", "TW", "KP", "KR", "MM", "PH", "TH", "ID"],
  Oceania: ["PG", "FJ", "AU", "NZ"],
  "North America": ["US", "CA"],
  "Latin America & Caribbean": ["MX", "HT", "VE", "CO", "EC", "HN", "BR"],
};

export function gdeltRegionQuery(region: string): string {
  const codes = REGION_WATCH[region] ?? countriesInRegion(region).slice(0, 8).map((c) => c.iso2);
  const terms = codes.map((c) => {
    const q = gdeltCountryQuery(c);
    return q.startsWith("(") ? q : q;
  });
  return `(${terms.join(" OR ")})`;
}

export function gdeltThemeQuery(theme: ThemeId, within?: { type: "country" | "region"; id: string }): string {
  const base = THEME_MAP[theme].gdelt;
  if (!within) return base;
  const scope = within.type === "country" ? gdeltCountryQuery(within.id) : gdeltRegionQuery(within.id);
  return `${scope} ${base}`;
}

export interface GdeltResult {
  ok: boolean;
  count: number;
  error?: string;
  articles: Article[];
}

async function callGdelt(qs: string): Promise<string> {
  const base = env.gdeltBase;
  try {
    return await fetchText(`${base}?${qs}`, { timeoutMs: 20000 });
  } catch (e) {
    // Some networks reset TLS to GDELT. GDELT also serves plain HTTP, so retry once over HTTP.
    if (base.startsWith("https://")) {
      return await fetchText(`${base.replace(/^https:/, "http:")}?${qs}`, { timeoutMs: 20000 });
    }
    throw e;
  }
}

export async function gdeltSearch(query: string, opts: { timespan?: string; max?: number; feedId?: string } = {}): Promise<GdeltResult> {
  if (!query) return { ok: false, count: 0, error: "empty query", articles: [] };
  const lang = env.gdeltLang;
  const q = `${query}${lang ? ` sourcelang:${lang}` : ""}`;
  const qs = new URLSearchParams({
    query: q,
    mode: "artlist",
    maxrecords: String(Math.min(opts.max ?? 150, 250)),
    format: "json",
    sort: "datedesc",
    timespan: opts.timespan ?? "72h",
  }).toString();
  try {
    const body = await throttled(() => callGdelt(qs));
    let json: { articles?: GdeltArticle[] };
    try {
      json = JSON.parse(body);
    } catch {
      return { ok: false, count: 0, error: `GDELT: ${body.slice(0, 120).replace(/\s+/g, " ")}`, articles: [] };
    }
    const now = new Date();
    const out: Article[] = [];
    for (const g of json.articles ?? []) {
      const domain = g.domain || "";
      const prof = profileForDomain(domain || g.url);
      const raw: RawItem = {
        url: g.url,
        title: g.title,
        published: parseSeen(g.seendate),
        lang: LANG_MAP[(g.language || "").toLowerCase()] ?? (g.language || "en").slice(0, 2).toLowerCase(),
        aggregator: "gdelt",
        feedId: opts.feedId ?? "gdelt",
        source: { name: prof.name, domain: prof.domain, type: prof.type, band: prof.band, family: prof.family },
      };
      const a = toArticle(raw, now);
      if (a) out.push(a);
    }
    return { ok: true, count: out.length, articles: out };
  } catch (e) {
    return { ok: false, count: 0, error: (e as Error).message, articles: [] };
  }
}
