import { getStore } from "../store";
import type { Article, ThemeId } from "../types";
import { FEEDS } from "./registry";
import { pullFeed, type FeedResult } from "./rss";
import { gdeltCountryQuery, gdeltRegionQuery, gdeltSearch, gdeltThemeQuery } from "./gdelt";
import { reliefwebLatest } from "./reliefweb";
import { BY_ISO2, BY_ISO3 } from "../geo/countries";
import { pool } from "./http";
import { env } from "../env";

export interface IngestSummary {
  source: string;
  ok: boolean;
  fetched: number;
  stored: number;
  detail?: unknown;
  error?: string;
}

export async function ingestRss(): Promise<IngestSummary> {
  const store = getStore();
  const results: FeedResult[] = await pool(FEEDS, 8, (f) => pullFeed(f));
  const all: Article[] = results.flatMap((r) => r.articles);
  const stored = all.length ? await store.upsertArticles(all) : 0;
  const okFeeds = results.filter((r) => r.ok).length;
  const detail = results.map((r) => ({ id: r.feedId, ok: r.ok, count: r.count, ms: r.ms, error: r.error }));
  await store.logIngest({ source: "rss", ok: okFeeds > 0, count: stored, detail });
  return { source: "rss", ok: okFeeds > 0, fetched: all.length, stored, detail };
}

export type GdeltJob =
  | { kind: "theme"; theme: ThemeId; timespan?: string }
  | { kind: "country"; iso2: string; timespan?: string }
  | { kind: "region"; region: string; timespan?: string }
  | { kind: "theme-within"; theme: ThemeId; within: { type: "country" | "region"; id: string }; timespan?: string };

export async function ingestGdelt(job: GdeltJob): Promise<IngestSummary> {
  const store = getStore();
  let q = "";
  let feedId = "gdelt";
  if (job.kind === "theme") {
    q = gdeltThemeQuery(job.theme);
    feedId = `gdelt:${job.theme}`;
  } else if (job.kind === "country") {
    q = gdeltCountryQuery(job.iso2);
    feedId = `gdelt:${job.iso2}`;
  } else if (job.kind === "region") {
    q = gdeltRegionQuery(job.region);
    feedId = "gdelt:region";
  } else {
    q = gdeltThemeQuery(job.theme, job.within);
    feedId = `gdelt:${job.theme}:${job.within.id}`;
  }
  const res = await gdeltSearch(q, { timespan: job.timespan ?? "72h", max: 200, feedId });
  const stored = res.articles.length ? await store.upsertArticles(res.articles) : 0;
  await store.logIngest({ source: feedId, ok: res.ok, count: stored, detail: res.error ? { error: res.error } : undefined });
  return { source: feedId, ok: res.ok, fetched: res.count, stored, error: res.error };
}

export async function ingestReliefweb(iso2?: string): Promise<IngestSummary> {
  const store = getStore();
  const iso3 = iso2 ? BY_ISO2[iso2]?.iso3 : undefined;
  const res = await reliefwebLatest({ limit: 100, iso3 });
  const stored = res.articles.length ? await store.upsertArticles(res.articles) : 0;
  await store.logIngest({ source: "reliefweb", ok: res.ok, count: stored, detail: res.error ? { error: res.error } : undefined });
  return { source: "reliefweb", ok: res.ok, fetched: res.count, stored, error: res.error };
}

/** Minimum gap between automatic background refreshes. */
const REFRESH_MS = 12 * 60 * 1000;

/**
 * Ensures the store has recent RSS data. Uses a cache-backed lock so concurrent page loads do not stampede feeds.
 * Returns true when a refresh was run.
 */
export async function refreshIfStale(): Promise<boolean> {
  const store = getStore();
  const last = await store.latestFetch();
  const age = last ? Date.now() - new Date(last).getTime() : Infinity;
  if (age < REFRESH_MS) return false;
  const lock = await store.getCache("ingest-lock");
  if (lock) return false;
  await store.setCache("ingest-lock", { at: Date.now() }, 90);
  await ingestRss();
  if (env.reliefwebAppname) await ingestReliefweb();
  return true;
}

export { BY_ISO3 };
