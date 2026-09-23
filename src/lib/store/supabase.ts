import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Article, ThemeId } from "../types";
import type { ArticleQuery, IngestLog, ReportSummary, SavedReport, Store } from "./types";
import { summarise } from "./memory";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function toRow(a: Article): Row {
  return {
    id: a.id,
    url: a.url,
    title: a.title,
    excerpt: a.excerpt,
    source_name: a.sourceName,
    domain: a.domain,
    source_type: a.sourceType,
    family: a.family,
    band: a.band,
    aggregator: a.aggregator,
    feed_id: a.feedId,
    published_at: a.publishedAt,
    fetched_at: a.fetchedAt,
    lang: a.lang,
    countries: a.countries,
    regions: a.regions,
    themes: a.themes,
  };
}
function fromRow(r: Row): Article {
  return {
    id: r.id,
    url: r.url,
    title: r.title,
    excerpt: r.excerpt ?? "",
    sourceName: r.source_name,
    domain: r.domain,
    sourceType: r.source_type,
    family: r.family,
    band: r.band,
    aggregator: r.aggregator,
    feedId: r.feed_id ?? "",
    publishedAt: new Date(r.published_at).toISOString(),
    fetchedAt: new Date(r.fetched_at).toISOString(),
    lang: r.lang ?? "en",
    countries: r.countries ?? [],
    regions: r.regions ?? [],
    themes: (r.themes ?? []) as ThemeId[],
  };
}
function fail(where: string, error: { message: string } | null): never {
  throw new Error(`Supabase ${where}: ${error?.message ?? "unknown error"}`);
}

export function supabaseStore(url: string, key: string): Store {
  const db: SupabaseClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    kind: "supabase",
    async upsertArticles(list) {
      let n = 0;
      for (let i = 0; i < list.length; i += 400) {
        const chunk = list.slice(i, i + 400).map(toRow);
        // De-duplicate within the chunk: Postgres rejects two rows with the same key in one upsert.
        const uniq = [...new Map(chunk.map((r) => [r.id, r])).values()];
        const { error } = await db.from("articles").upsert(uniq, { onConflict: "id" });
        if (error) fail("upsert articles", error);
        n += uniq.length;
      }
      return n;
    },
    async queryArticles(q: ArticleQuery) {
      let qb = db.from("articles").select("*").gte("published_at", q.sinceISO).order("published_at", { ascending: false }).limit(q.limit);
      if (q.countries?.length) qb = qb.overlaps("countries", q.countries);
      if (q.regions?.length) qb = qb.overlaps("regions", q.regions);
      if (q.themes?.length) qb = qb.overlaps("themes", q.themes);
      if (q.aggregator) qb = qb.eq("aggregator", q.aggregator);
      if (q.q) {
        const safe = q.q.replace(/[%,()*\\]/g, " ").trim();
        if (safe) qb = qb.or(`title.ilike.%${safe}%,excerpt.ilike.%${safe}%,source_name.ilike.%${safe}%`);
      }
      const { data, error } = await qb;
      if (error) fail("query articles", error);
      return (data ?? []).map(fromRow);
    },
    async countArticles() {
      const { count, error } = await db.from("articles").select("id", { count: "exact", head: true });
      if (error) fail("count articles", error);
      return count ?? 0;
    },
    async latestFetch() {
      const { data, error } = await db.from("articles").select("fetched_at").order("fetched_at", { ascending: false }).limit(1);
      if (error) fail("latest fetch", error);
      return data?.[0]?.fetched_at ? new Date(data[0].fetched_at).toISOString() : null;
    },
    async saveReport(r) {
      const { data, error } = await db
        .from("reports")
        .insert({ analyst: r.analyst, kind: r.kind, title: r.title, scope: r.scope, report: r.report, evidence: r.evidence, meta: r.meta })
        .select("*")
        .single();
      if (error) fail("save report", error);
      return rowToReport(data as Row);
    },
    async listReports(limit) {
      const { data, error } = await db.from("reports").select("id,created_at,analyst,kind,title,scope,report").order("created_at", { ascending: false }).limit(limit);
      if (error) fail("list reports", error);
      return (data ?? []).map((r: Row) => summarise(rowToReport(r)) as ReportSummary);
    },
    async getReport(id) {
      const { data, error } = await db.from("reports").select("*").eq("id", id).maybeSingle();
      if (error) fail("get report", error);
      return data ? rowToReport(data as Row) : null;
    },
    async deleteReport(id) {
      const { error } = await db.from("reports").delete().eq("id", id);
      if (error) fail("delete report", error);
    },
    async logAi(kind, analyst, model, p, c) {
      const { error } = await db.from("ai_usage").insert({ kind, analyst, model, prompt_tokens: p, completion_tokens: c });
      if (error) fail("log ai", error);
    },
    async countAi(sinceISO) {
      const { count, error } = await db.from("ai_usage").select("id", { count: "exact", head: true }).gte("created_at", sinceISO);
      if (error) fail("count ai", error);
      return count ?? 0;
    },
    async getCache<T>(key: string) {
      const { data, error } = await db.from("cache").select("value,expires_at").eq("key", key).maybeSingle();
      if (error) return null;
      if (!data || new Date(data.expires_at).getTime() < Date.now()) return null;
      return data.value as T;
    },
    async setCache(key, value, ttlSec) {
      await db.from("cache").upsert({ key, value, expires_at: new Date(Date.now() + ttlSec * 1000).toISOString() }, { onConflict: "key" });
    },
    async logIngest(l) {
      await db.from("ingest_runs").insert({ source: l.source, ok: l.ok, count: l.count, detail: l.detail ?? null });
    },
    async recentIngest(limit) {
      const { data } = await db.from("ingest_runs").select("*").order("created_at", { ascending: false }).limit(limit);
      return (data ?? []).map((r: Row): IngestLog => ({ createdAt: new Date(r.created_at).toISOString(), source: r.source, ok: r.ok, count: r.count, detail: r.detail }));
    },
    async prune(days) {
      const cutoff = new Date(Date.now() - days * 86400000).toISOString();
      await db.from("articles").delete().lt("published_at", cutoff);
      await db.from("ingest_runs").delete().lt("created_at", cutoff);
      await db.from("cache").delete().lt("expires_at", new Date().toISOString());
    },
  };
}

function rowToReport(r: Row): SavedReport {
  return {
    id: r.id,
    createdAt: new Date(r.created_at).toISOString(),
    analyst: r.analyst ?? "",
    kind: r.kind,
    title: r.title,
    scope: r.scope,
    report: r.report,
    evidence: r.evidence ?? null,
    meta: r.meta ?? null,
  };
}
