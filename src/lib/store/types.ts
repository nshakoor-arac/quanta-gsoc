import type { Article, ThemeId } from "../types";

export interface ArticleQuery {
  sinceISO: string;
  countries?: string[];
  regions?: string[];
  themes?: ThemeId[];
  q?: string;
  aggregator?: string;
  limit: number;
}

export interface SavedReport {
  id: string;
  createdAt: string;
  analyst: string;
  kind: "sitrep" | "compare";
  title: string;
  scope: unknown;
  report: unknown;
  evidence: unknown;
  meta: unknown;
}

export interface ReportSummary {
  id: string;
  createdAt: string;
  analyst: string;
  kind: "sitrep" | "compare";
  title: string;
  scope: unknown;
  keyJudgment?: string;
  threat?: string;
}

export interface IngestLog {
  createdAt: string;
  source: string;
  ok: boolean;
  count: number;
  detail?: unknown;
}

export interface Store {
  kind: "supabase" | "memory";
  upsertArticles(a: Article[]): Promise<number>;
  queryArticles(q: ArticleQuery): Promise<Article[]>;
  countArticles(): Promise<number>;
  latestFetch(): Promise<string | null>;
  saveReport(r: Omit<SavedReport, "id" | "createdAt">): Promise<SavedReport>;
  listReports(limit: number): Promise<ReportSummary[]>;
  getReport(id: string): Promise<SavedReport | null>;
  deleteReport(id: string): Promise<void>;
  logAi(kind: string, analyst: string, model: string, promptTokens: number, completionTokens: number): Promise<void>;
  countAi(sinceISO: string): Promise<number>;
  getCache<T = unknown>(key: string): Promise<T | null>;
  setCache(key: string, value: unknown, ttlSec: number): Promise<void>;
  logIngest(l: Omit<IngestLog, "createdAt">): Promise<void>;
  recentIngest(limit: number): Promise<IngestLog[]>;
  prune(days: number): Promise<void>;
}
