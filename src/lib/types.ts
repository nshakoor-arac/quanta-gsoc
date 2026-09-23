export type ThemeId =
  | "conflict"
  | "terrorism"
  | "unrest"
  | "governance"
  | "humanitarian"
  | "migration"
  | "economic"
  | "cyber"
  | "hazard";

export type Band = "green" | "amber" | "red" | "unrated";
export type Aggregator = "rss" | "gdelt" | "reliefweb";
export type SourceType =
  | "wire"
  | "broadcaster"
  | "newspaper"
  | "igo"
  | "ngo"
  | "thinktank"
  | "specialist"
  | "government"
  | "state-media"
  | "aggregator"
  | "unclassified";

/** One aggregated item. Only metadata and a short excerpt are stored, never full article text. */
export interface Article {
  id: string;
  url: string;
  title: string;
  excerpt: string;
  sourceName: string;
  domain: string;
  sourceType: SourceType;
  /** Upstream family used by the independence test. Outlets in one family count as one stream. */
  family: string;
  /** Provisional automated triage band. Analysts confirm or override. */
  band: Band;
  aggregator: Aggregator;
  feedId: string;
  publishedAt: string;
  fetchedAt: string;
  lang: string;
  countries: string[];
  regions: string[];
  themes: ThemeId[];
}

export type WindowKey = "24h" | "72h" | "7d" | "30d";
export const WINDOW_HOURS: Record<WindowKey, number> = { "24h": 24, "72h": 72, "7d": 168, "30d": 720 };

export type ScopeType = "global" | "region" | "country" | "theme";

export interface ScopeTarget {
  type: ScopeType;
  /** iso2 for country, region name for region, theme id for theme, "global" for global */
  id: string;
  /** Optional narrowing: a theme scoped to a country or region. */
  within?: { type: "country" | "region"; id: string };
}

export interface EvidenceItem {
  n: number; // citation number [n]
  article: Article;
  bandUsed: Band;
  pinned: boolean;
}

export interface Baseline {
  code: string; // e.g. B1
  iso2: string;
  indicator: string;
  label: string;
  value: number;
  year: string;
  source: string;
}

export type ThreatLevel = "critical" | "high" | "elevated" | "moderate" | "low";
export type ConfidenceBand = "high" | "moderate" | "low";
