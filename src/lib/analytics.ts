import type { Article, Band, ThemeId } from "./types";
import { BY_ISO2 } from "./geo/lite";

export interface Agg {
  total: number;
  sources: number;
  countries: number;
  independentStreams: number;
  byCountry: { iso2: string; n: number }[];
  byTheme: { id: ThemeId; n: number }[];
  bySource: { name: string; domain: string; n: number; band: Band; type: string }[];
  byBand: Record<Band, number>;
  byAggregator: Record<string, number>;
  hhi: number; // 0..1 source concentration
  topShare: number;
  series: { t: number; n: number }[];
  seriesUnit: "hour" | "day";
  themeByRegion: { region: string; counts: Record<string, number> }[];
  untagged: number;
}

export function aggregate(items: Article[], windowHours: number): Agg {
  const byCountry = new Map<string, number>();
  const byTheme = new Map<ThemeId, number>();
  const bySource = new Map<string, { name: string; domain: string; n: number; band: Band; type: string }>();
  const fam = new Set<string>();
  const byBand: Record<Band, number> = { green: 0, amber: 0, red: 0, unrated: 0 };
  const byAgg: Record<string, number> = {};
  const trByRegion = new Map<string, Record<string, number>>();
  let untagged = 0;
  for (const a of items) {
    for (const c of a.countries) byCountry.set(c, (byCountry.get(c) ?? 0) + 1);
    for (const t of a.themes) byTheme.set(t, (byTheme.get(t) ?? 0) + 1);
    if (!a.themes.length) untagged++;
    const k = a.domain || a.sourceName;
    const s = bySource.get(k) ?? { name: a.sourceName, domain: a.domain, n: 0, band: a.band, type: a.sourceType };
    s.n++;
    bySource.set(k, s);
    fam.add(a.family);
    byBand[a.band]++;
    byAgg[a.aggregator] = (byAgg[a.aggregator] ?? 0) + 1;
    for (const r of a.regions) {
      const row = trByRegion.get(r) ?? {};
      for (const t of a.themes) row[t] = (row[t] ?? 0) + 1;
      trByRegion.set(r, row);
    }
  }
  const total = items.length;
  const srcArr = [...bySource.values()].sort((a, b) => b.n - a.n);
  const hhi = total ? srcArr.reduce((s, x) => s + (x.n / total) ** 2, 0) : 0;
  const unit: "hour" | "day" = windowHours <= 72 ? "hour" : "day";
  const step = unit === "hour" ? 3600000 : 86400000;
  const end = Math.ceil(Date.now() / step) * step;
  const buckets = Math.min(unit === "hour" ? windowHours : Math.ceil(windowHours / 24), 60);
  const start = end - buckets * step;
  const series = Array.from({ length: buckets }, (_, i) => ({ t: start + i * step, n: 0 }));
  for (const a of items) {
    const i = Math.floor((new Date(a.publishedAt).getTime() - start) / step);
    if (i >= 0 && i < buckets) series[i].n++;
  }
  return {
    total,
    sources: bySource.size,
    countries: byCountry.size,
    independentStreams: fam.size,
    byCountry: [...byCountry].map(([iso2, n]) => ({ iso2, n })).sort((a, b) => b.n - a.n),
    byTheme: [...byTheme].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n),
    bySource: srcArr,
    byBand,
    byAggregator: byAgg,
    hhi,
    topShare: total && srcArr[0] ? srcArr[0].n / total : 0,
    series,
    seriesUnit: unit,
    themeByRegion: [...trByRegion].map(([region, counts]) => ({ region, counts })).sort((a, b) => a.region.localeCompare(b.region)),
    untagged,
  };
}

/** Simple burst check: compares the latest half of the window to the earlier half. Returns null when data is thin. */
export function momentum(items: Article[], windowHours: number): { recent: number; prior: number; pct: number | null } {
  const now = Date.now();
  const half = (windowHours * 3600000) / 2;
  let recent = 0;
  let prior = 0;
  for (const a of items) {
    const age = now - new Date(a.publishedAt).getTime();
    if (age <= half) recent++;
    else if (age <= half * 2) prior++;
  }
  return { recent, prior, pct: prior >= 10 ? Math.round(((recent - prior) / prior) * 100) : null };
}

export function countryLabel(iso2: string) {
  return BY_ISO2[iso2]?.name ?? iso2;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 90) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
