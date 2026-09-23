import { z } from "zod";

const Themes = z.enum(["conflict", "terrorism", "unrest", "governance", "humanitarian", "migration", "economic", "cyber", "hazard"]);
export const WindowZ = z.enum(["24h", "72h", "7d", "30d"]);

export const ArticleZ = z.object({
  id: z.string().min(4).max(80),
  url: z.string().url().max(2000).refine((u) => /^https?:\/\//i.test(u), "http(s) only"),
  title: z.string().min(3).max(400),
  excerpt: z.string().max(600).default(""),
  sourceName: z.string().max(120),
  domain: z.string().max(200),
  sourceType: z.enum(["wire", "broadcaster", "newspaper", "igo", "ngo", "thinktank", "specialist", "government", "state-media", "aggregator", "unclassified"]),
  family: z.string().max(120),
  band: z.enum(["green", "amber", "red", "unrated"]),
  aggregator: z.enum(["rss", "gdelt", "reliefweb"]),
  feedId: z.string().max(120).default(""),
  publishedAt: z.string().max(40),
  fetchedAt: z.string().max(40),
  lang: z.string().max(8).default("en"),
  countries: z.array(z.string().max(3)).max(12).default([]),
  regions: z.array(z.string().max(60)).max(12).default([]),
  themes: z.array(Themes).max(9).default([]),
});

export const PinnedZ = z.object({ article: ArticleZ, band: z.enum(["green", "amber", "red", "unrated"]).optional() });

export const ScopeZ = z.object({
  type: z.enum(["global", "region", "country", "theme"]),
  id: z.string().min(1).max(80),
  within: z.object({ type: z.enum(["country", "region"]), id: z.string().max(80) }).optional(),
});

export const SitrepReqZ = z.object({
  scope: ScopeZ,
  window: WindowZ.default("72h"),
  pinned: z.array(PinnedZ).max(40).default([]),
  effort: z.enum(["low", "medium", "high"]).optional(),
});

export const CompareReqZ = z.object({
  targets: z.array(ScopeZ).min(2).max(4),
  window: WindowZ.default("72h"),
  pinned: z.array(PinnedZ).max(40).default([]),
  effort: z.enum(["low", "medium", "high"]).optional(),
});

export const QuickReqZ = z.object({
  kind: z.enum(["article", "country", "feed"]),
  window: WindowZ.default("72h"),
  article: ArticleZ.optional(),
  iso2: z.string().max(3).optional(),
  filters: z
    .object({
      countries: z.array(z.string().max(3)).max(10).optional(),
      regions: z.array(z.string().max(60)).max(5).optional(),
      themes: z.array(Themes).max(9).optional(),
      q: z.string().max(80).optional(),
    })
    .optional(),
  withStats: z.boolean().optional(),
});
