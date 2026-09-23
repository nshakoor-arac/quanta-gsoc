import { randomUUID } from "node:crypto";
import type { Article } from "../types";
import type { ArticleQuery, IngestLog, ReportSummary, SavedReport, Store } from "./types";

interface Mem {
  articles: Map<string, Article>;
  reports: Map<string, SavedReport>;
  ai: { at: number; kind: string; analyst: string }[];
  cache: Map<string, { value: unknown; exp: number }>;
  ingest: IngestLog[];
}

const g = globalThis as unknown as { __gsocMem?: Mem };
function mem(): Mem {
  if (!g.__gsocMem) g.__gsocMem = { articles: new Map(), reports: new Map(), ai: [], cache: new Map(), ingest: [] };
  return g.__gsocMem;
}

export function memoryStore(): Store {
  return {
    kind: "memory",
    async upsertArticles(list) {
      const m = mem();
      for (const a of list) m.articles.set(a.id, a);
      return list.length;
    },
    async queryArticles(q: ArticleQuery) {
      const since = new Date(q.sinceISO).getTime();
      const needle = q.q?.toLowerCase();
      const out: Article[] = [];
      for (const a of mem().articles.values()) {
        if (new Date(a.publishedAt).getTime() < since) continue;
        if (q.countries?.length && !a.countries.some((c) => q.countries!.includes(c))) continue;
        if (q.regions?.length && !a.regions.some((c) => q.regions!.includes(c))) continue;
        if (q.themes?.length && !a.themes.some((c) => q.themes!.includes(c))) continue;
        if (q.aggregator && a.aggregator !== q.aggregator) continue;
        if (needle && !(a.title.toLowerCase().includes(needle) || a.excerpt.toLowerCase().includes(needle) || a.sourceName.toLowerCase().includes(needle))) continue;
        out.push(a);
      }
      out.sort((x, y) => y.publishedAt.localeCompare(x.publishedAt));
      return out.slice(0, q.limit);
    },
    async countArticles() {
      return mem().articles.size;
    },
    async latestFetch() {
      let best: string | null = null;
      for (const a of mem().articles.values()) if (!best || a.fetchedAt > best) best = a.fetchedAt;
      return best;
    },
    async saveReport(r) {
      const rec: SavedReport = { ...r, id: randomUUID(), createdAt: new Date().toISOString() };
      mem().reports.set(rec.id, rec);
      return rec;
    },
    async listReports(limit) {
      return [...mem().reports.values()]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map(summarise);
    },
    async getReport(id) {
      return mem().reports.get(id) ?? null;
    },
    async deleteReport(id) {
      mem().reports.delete(id);
    },
    async logAi(kind, analyst) {
      mem().ai.push({ at: Date.now(), kind, analyst });
    },
    async countAi(sinceISO) {
      const s = new Date(sinceISO).getTime();
      return mem().ai.filter((x) => x.at >= s).length;
    },
    async getCache<T>(key: string) {
      const e = mem().cache.get(key);
      if (!e || e.exp < Date.now()) return null;
      return e.value as T;
    },
    async setCache(key, value, ttlSec) {
      mem().cache.set(key, { value, exp: Date.now() + ttlSec * 1000 });
    },
    async logIngest(l) {
      const m = mem();
      m.ingest.unshift({ ...l, createdAt: new Date().toISOString() });
      m.ingest = m.ingest.slice(0, 200);
    },
    async recentIngest(limit) {
      return mem().ingest.slice(0, limit);
    },
    async prune(days) {
      const cutoff = Date.now() - days * 86400000;
      const m = mem();
      for (const [id, a] of m.articles) if (new Date(a.publishedAt).getTime() < cutoff) m.articles.delete(id);
    },
  };
}

export function summarise(r: SavedReport): ReportSummary {
  const rep = r.report as { key_judgment?: string; threat_level?: string } | null;
  return { id: r.id, createdAt: r.createdAt, analyst: r.analyst, kind: r.kind, title: r.title, scope: r.scope, keyJudgment: rep?.key_judgment, threat: rep?.threat_level };
}
