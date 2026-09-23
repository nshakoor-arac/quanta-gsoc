import type { Article, Band, SourceType, ThemeId } from "@/lib/types";

export interface Filters {
  q: string;
  countries: string[];
  regions: string[];
  themes: ThemeId[];
  bands: Band[];
  types: SourceType[];
  agg: "" | "rss" | "gdelt" | "reliefweb";
}

export const EMPTY_FILTERS: Filters = { q: "", countries: [], regions: [], themes: [], bands: [], types: [], agg: "" };

export function isFiltered(f: Filters): boolean {
  return !!(f.q || f.countries.length || f.regions.length || f.themes.length || f.bands.length || f.types.length || f.agg);
}

export function applyFilters(items: Article[], f: Filters): Article[] {
  const q = f.q.trim().toLowerCase();
  return items.filter((a) => {
    if (f.countries.length && !a.countries.some((c) => f.countries.includes(c))) return false;
    if (f.regions.length && !a.regions.some((r) => f.regions.includes(r))) return false;
    if (f.themes.length && !a.themes.some((t) => f.themes.includes(t))) return false;
    if (f.bands.length && !f.bands.includes(a.band)) return false;
    if (f.types.length && !f.types.includes(a.sourceType)) return false;
    if (f.agg && a.aggregator !== f.agg) return false;
    if (q && !(a.title.toLowerCase().includes(q) || a.excerpt.toLowerCase().includes(q) || a.sourceName.toLowerCase().includes(q))) return false;
    return true;
  });
}

export function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}
