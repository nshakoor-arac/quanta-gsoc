import type { Article, Baseline, EvidenceItem, ScopeTarget, ThemeId, WindowKey } from "../types";
import { WINDOW_HOURS } from "../types";
import { getStore } from "../store";
import { BY_ISO2, REGIONS } from "../geo/countries";
import { themeLabel } from "../taxonomy";
import { baselinesFor } from "../sources/context";
import { ingestGdelt, ingestReliefweb, refreshIfStale } from "../sources/ingest";
import { env } from "../env";
import { aggregate } from "../analytics";
import { applyCeiling, computeMetrics, confidenceCeiling, independentStreams, selectEvidence, type EvidenceMetrics } from "./evidence";
import { compareUser, KERNEL, quickUser, sitrepUser, COMPARE_FORMAT, SITREP_FORMAT } from "./prompts";
import { CompareSchema, QuickSchema, SitrepSchema, jsonSchemaOf, type Compare, type Quick, type Sitrep } from "./schemas";
import { auditCitations, deepSanitize, extractJson } from "./sanitize";
import { complete } from "./mercury";
import type { z } from "zod";

export function isTheme(id: string): id is ThemeId {
  return ["conflict", "terrorism", "unrest", "governance", "humanitarian", "migration", "economic", "cyber", "hazard"].includes(id);
}

export function validateTarget(t: ScopeTarget): string | null {
  if (t.type === "global") return null;
  if (t.type === "country" && !BY_ISO2[t.id]) return `Unknown country code "${t.id}"`;
  if (t.type === "region" && !REGIONS.includes(t.id)) return `Unknown region "${t.id}"`;
  if (t.type === "theme" && !isTheme(t.id)) return `Unknown theme "${t.id}"`;
  if (t.within) {
    if (t.within.type === "country" && !BY_ISO2[t.within.id]) return `Unknown country code "${t.within.id}"`;
    if (t.within.type === "region" && !REGIONS.includes(t.within.id)) return `Unknown region "${t.within.id}"`;
  }
  return null;
}

export function scopeLabel(t: ScopeTarget): string {
  const within = t.within ? ` within ${t.within.type === "country" ? BY_ISO2[t.within.id]?.name ?? t.within.id : t.within.id}` : "";
  if (t.type === "global") return "Global";
  if (t.type === "country") return BY_ISO2[t.id]?.name ?? t.id;
  if (t.type === "region") return t.id;
  return `${themeLabel(t.id)}${within}`;
}

function scopeCode(t: ScopeTarget): string {
  if (t.type === "global") return "GLB";
  if (t.type === "country") return t.id;
  if (t.type === "region") return t.id.split(/[\s&]+/).filter((w) => w.length > 2).map((w) => w[0]).join("").toUpperCase().slice(0, 4);
  return t.id.slice(0, 4).toUpperCase();
}

export function docId(kind: "SITREP" | "CMP", targets: ScopeTarget[], now: Date): string {
  const code = targets.length > 1 ? targets.map(scopeCode).join("-").slice(0, 24) : scopeCode(targets[0]);
  const y = now.getUTCFullYear();
  const md = `${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
  const hm = `${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}`;
  return `QAP-${kind}-${code}-${y}-${md}-${hm}`;
}

function sinceISO(w: WindowKey): string {
  return new Date(Date.now() - WINDOW_HOURS[w] * 3600000).toISOString();
}

function gdeltSpan(w: WindowKey): string {
  return w === "24h" ? "24h" : w === "72h" ? "72h" : w === "7d" ? "7d" : "30d";
}

function queryFor(t: ScopeTarget, w: WindowKey, limit = 600) {
  const q: { sinceISO: string; countries?: string[]; regions?: string[]; themes?: ThemeId[]; limit: number } = { sinceISO: sinceISO(w), limit };
  if (t.type === "country") q.countries = [t.id];
  if (t.type === "region") q.regions = [t.id];
  if (t.type === "theme") {
    q.themes = [t.id as ThemeId];
    if (t.within?.type === "country") q.countries = [t.within.id];
    if (t.within?.type === "region") q.regions = [t.within.id];
  }
  return q;
}

/** Collects candidate articles for a scope, topping up from live aggregators when the store is thin. */
export async function gatherCandidates(t: ScopeTarget, w: WindowKey): Promise<{ articles: Article[]; toppedUp: string[] }> {
  const store = getStore();
  const toppedUp: string[] = [];
  let articles = await store.queryArticles(queryFor(t, w));
  if ((await store.countArticles()) < 20) {
    await refreshIfStale().catch(() => undefined);
    articles = await store.queryArticles(queryFor(t, w));
  }
  if (t.type !== "global" && articles.length < 30) {
    const span = gdeltSpan(w);
    if (t.type === "country") {
      // ReliefWeb is the preferred live top-up for country analysis.
      if (env.reliefwebAppname) {
        const rw = await Promise.race([
          ingestReliefweb(t.id),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 14000)),
        ]).catch(() => null);
        if (rw) toppedUp.push(`reliefweb:${rw.ok ? rw.stored : "failed"}`);
        articles = await store.queryArticles(queryFor(t, w));
      }
      // GDELT is supplemental only. Use it if curated RSS plus ReliefWeb remain thin.
      if (articles.length < 15) {
        const gd = await Promise.race([
          ingestGdelt({ kind: "country", iso2: t.id, timespan: span }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 14000)),
        ]).catch(() => null);
        if (gd) toppedUp.push(`gdelt:${gd.ok ? gd.stored : "failed"}`);
      }
    } else if (t.type === "region") {
      const gd = await Promise.race([
        ingestGdelt({ kind: "region", region: t.id, timespan: span }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 14000)),
      ]).catch(() => null);
      if (gd) toppedUp.push(`gdelt:${gd.ok ? gd.stored : "failed"}`);
    } else if (t.type === "theme") {
      const gd = await Promise.race([
        t.within
          ? ingestGdelt({ kind: "theme-within", theme: t.id as ThemeId, within: t.within, timespan: span })
          : ingestGdelt({ kind: "theme", theme: t.id as ThemeId, timespan: span }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 14000)),
      ]).catch(() => null);
      if (gd) toppedUp.push(`gdelt:${gd.ok ? gd.stored : "failed"}`);
    }
    articles = await store.queryArticles(queryFor(t, w));
  }
  // GDELT country/region queries can return items whose text does not name the country; keep strict tag matches for scoped runs.
  return { articles, toppedUp };
}

export interface PinnedIn {
  article: Article;
  band?: Article["band"];
}

export interface PreparedSitrep {
  kind: "sitrep";
  targets: ScopeTarget[];
  label: string;
  window: WindowKey;
  evidence: EvidenceItem[];
  baselines: Baseline[];
  metrics: EvidenceMetrics;
  ceiling: { band: "high" | "moderate" | "low"; reason: string };
  system: string;
  user: string;
  toppedUp: string[];
  id: string;
  now: Date;
}

export interface PreparedCompare extends Omit<PreparedSitrep, "kind"> {
  kind: "compare";
  perTarget: { label: string; items: number; streams: number }[];
  groups: { label: string; evidence: EvidenceItem[] }[];
}

function baselineCountries(targets: ScopeTarget[]): string[] {
  const out = new Set<string>();
  for (const t of targets) {
    if (t.type === "country") out.add(t.id);
    else if (t.within?.type === "country") out.add(t.within.id);
  }
  return [...out].slice(0, 4);
}

export async function prepareSitrep(target: ScopeTarget, window: WindowKey, pinned: PinnedIn[]): Promise<PreparedSitrep> {
  const now = new Date();
  const { articles, toppedUp } = await gatherCandidates(target, window);
  const evidence = selectEvidence(articles, { max: 36, pinned, perFamily: target.type === "global" ? 3 : 4, perCountry: target.type === "global" ? 4 : 999 });
  const baselines = await baselinesFor(baselineCountries([target]));
  const metrics = computeMetrics(evidence);
  const ceiling = confidenceCeiling(metrics);
  const label = scopeLabel(target);
  return {
    kind: "sitrep",
    targets: [target],
    label,
    window,
    evidence,
    baselines,
    metrics,
    ceiling,
    system: `${KERNEL}\n\n${SITREP_FORMAT}`,
    user: sitrepUser({ scopeLabel: label, scopeKind: target.type, window, evidence, baselines, metrics, ceiling, now }),
    toppedUp,
    id: docId("SITREP", [target], now),
    now,
  };
}

export async function prepareCompare(targets: ScopeTarget[], window: WindowKey, pinned: PinnedIn[]): Promise<PreparedCompare> {
  const now = new Date();
  const results = await Promise.all(targets.map((t) => gatherCandidates(t, window)));
  const groups: { label: string; evidence: EvidenceItem[] }[] = [];
  let n = 1;
  const all: EvidenceItem[] = [];
  const topped: string[] = [];
  targets.forEach((t, i) => {
    const label = scopeLabel(t);
    const pins = pinned.filter((p) => {
      if (t.type === "country") return p.article.countries.includes(t.id);
      if (t.type === "region") return p.article.regions.includes(t.id);
      if (t.type === "theme") return p.article.themes.includes(t.id as ThemeId);
      return false;
    });
    const ev = selectEvidence(results[i].articles, { max: Math.floor(40 / targets.length), pinned: pins, perFamily: 3, startN: n });
    n += ev.length;
    groups.push({ label, evidence: ev });
    all.push(...ev);
    topped.push(...results[i].toppedUp.map((x) => `${label}:${x}`));
  });
  const baselines = await baselinesFor(baselineCountries(targets));
  const metrics = computeMetrics(all);
  const perTarget = groups.map((g) => ({ label: g.label, items: g.evidence.length, streams: independentStreams(g.evidence.map((e) => e.article)) }));
  // The ceiling for a comparison is set by the thinnest target, because a comparison is only as sound as its weakest side.
  const weakest = perTarget.reduce((a, b) => (a.streams <= b.streams ? a : b));
  const weakMetrics: EvidenceMetrics = { ...metrics, items: weakest.items, independentStreams: weakest.streams };
  const ceilBase = confidenceCeiling(weakMetrics);
  const ceiling = { band: ceilBase.band, reason: `the thinnest target (${weakest.label}) has ${weakest.streams} independent stream(s) across ${weakest.items} item(s)` };
  const labels = groups.map((g) => g.label);
  return {
    kind: "compare",
    targets,
    label: labels.join(" vs "),
    window,
    evidence: all,
    baselines,
    metrics,
    ceiling,
    system: `${KERNEL}\n\n${COMPARE_FORMAT}`,
    user: compareUser({ labels, scopeKind: targets[0].type, window, groups, baselines, metrics, perTarget, ceiling, now }),
    toppedUp: topped,
    id: docId("CMP", targets, now),
    now,
    perTarget,
    groups,
  };
}

/* ------------------------------------------------------------------
   Finalisation: parse, validate, audit citations, enforce ceiling, build register
   ------------------------------------------------------------------ */

export interface ReferenceRow {
  n: number;
  title: string;
  source: string;
  domain: string;
  type: string;
  band: string;
  provisionalBand: string;
  aggregator: string;
  publishedAt: string;
  url: string;
  family: string;
  pinned: boolean;
}

export function buildReferences(ev: EvidenceItem[]): ReferenceRow[] {
  return ev.map((e) => ({
    n: e.n,
    title: e.article.title,
    source: e.article.sourceName,
    domain: e.article.domain,
    type: e.article.sourceType,
    band: e.bandUsed,
    provisionalBand: e.article.band,
    aggregator: e.article.aggregator,
    publishedAt: e.article.publishedAt,
    url: e.article.url,
    family: e.article.family,
    pinned: e.pinned,
  }));
}

export interface FinalMeta {
  id: string;
  label: string;
  window: WindowKey;
  generatedAt: string;
  model: string;
  usage: { prompt: number; completion: number };
  metrics: EvidenceMetrics;
  ceiling: { band: string; reason: string };
  confidenceAdjusted: { modelBand: string; appliedBand: string; capped: boolean; reason: string };
  citation: { statements: number; cited: number; invalidRemoved: number; uncited: string[] };
  toppedUp: string[];
  baselines: Baseline[];
  references: ReferenceRow[];
  scope: ScopeTarget[];
  perTarget?: { label: string; items: number; streams: number }[];
}

const SITREP_STATEMENTS = ["key_judgment", "threat_rationale", "situation_overview", "key_developments", "assessment", "strategic_implications", "priority_points", "actor_dynamics", "know", "assess"];
const COMPARE_STATEMENTS = ["key_judgment", "convergences", "divergences", "implications", "know", "assess"];

async function parseWithRepair<S extends z.ZodType>(schema: S, schemaName: string, raw: string, system: string): Promise<{ data: z.infer<S>; usageExtra: { prompt: number; completion: number } }> {
  const attempt = (text: string) => {
    const json = extractJson(text);
    return schema.safeParse(json);
  };
  let first: ReturnType<typeof attempt> | null = null;
  try {
    first = attempt(raw);
    if (first.success) return { data: first.data, usageExtra: { prompt: 0, completion: 0 } };
  } catch (e) {
    first = null;
    void e;
  }
  const issues = first && !first.success ? first.error.issues.slice(0, 8).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : "The output was not valid JSON.";
  const fix = await complete({
    system: `${system}\n\nYou are repairing a previous answer. Return ONLY the corrected JSON object.`,
    user: `The previous output failed validation.\nProblems: ${issues}\n\nPrevious output:\n${raw.slice(0, 24000)}\n\nReturn the corrected JSON object only, keeping the content and citations.`,
    maxTokens: 7000,
    effort: "low",
    temperature: 0,
    schema: { name: schemaName, schema: jsonSchemaOf(schema) },
  });
  const second = attempt(fix.text);
  if (!second.success) throw new Error(`The AI response did not match the report format after a repair attempt (${second.error.issues[0]?.path.join(".")}: ${second.error.issues[0]?.message}).`);
  return { data: second.data, usageExtra: fix.usage };
}

export async function finaliseSitrep(prep: PreparedSitrep, raw: string, usage: { prompt: number; completion: number }): Promise<{ report: Sitrep; meta: FinalMeta }> {
  const { data, usageExtra } = await parseWithRepair(SitrepSchema, "qap_sitrep", raw, prep.system);
  const clean = deepSanitize(data);
  const maxB = prep.baselines.length;
  const audited = auditCitations(clean, prep.evidence.length, maxB, SITREP_STATEMENTS);
  const report = audited.report;
  const adj = applyCeiling(report.confidence.band, prep.metrics);
  report.confidence.band = adj.band;
  report.risks = report.risks.map((r) => ({ ...r, likelihood: clamp15(r.likelihood), impact: clamp15(r.impact) }));
  return {
    report,
    meta: {
      id: prep.id,
      label: prep.label,
      window: prep.window,
      generatedAt: prep.now.toISOString(),
      model: env.inceptionModel,
      usage: { prompt: usage.prompt + usageExtra.prompt, completion: usage.completion + usageExtra.completion },
      metrics: prep.metrics,
      ceiling: prep.ceiling,
      confidenceAdjusted: { modelBand: data.confidence.band, appliedBand: adj.band, capped: adj.capped, reason: adj.reason },
      citation: audited.stats,
      toppedUp: prep.toppedUp,
      baselines: prep.baselines,
      references: buildReferences(prep.evidence),
      scope: prep.targets,
    },
  };
}

export async function finaliseCompare(prep: PreparedCompare, raw: string, usage: { prompt: number; completion: number }): Promise<{ report: Compare; meta: FinalMeta }> {
  const { data, usageExtra } = await parseWithRepair(CompareSchema, "qap_compare", raw, prep.system);
  const clean = deepSanitize(data);
  const audited = auditCitations(clean, prep.evidence.length, prep.baselines.length, COMPARE_STATEMENTS);
  const report = audited.report;
  const adj = applyCeiling(report.confidence.band, { ...prep.metrics, items: Math.min(...prep.perTarget.map((p) => p.items)), independentStreams: Math.min(...prep.perTarget.map((p) => p.streams)) });
  report.confidence.band = adj.band;
  return {
    report,
    meta: {
      id: prep.id,
      label: prep.label,
      window: prep.window,
      generatedAt: prep.now.toISOString(),
      model: env.inceptionModel,
      usage: { prompt: usage.prompt + usageExtra.prompt, completion: usage.completion + usageExtra.completion },
      metrics: prep.metrics,
      ceiling: prep.ceiling,
      confidenceAdjusted: { modelBand: data.confidence.band, appliedBand: adj.band, capped: adj.capped, reason: adj.reason },
      citation: audited.stats,
      toppedUp: prep.toppedUp,
      baselines: prep.baselines,
      references: buildReferences(prep.evidence),
      scope: prep.targets,
      perTarget: prep.perTarget,
    },
  };
}

function clamp15(n: number) {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(5, Math.max(1, v)) : 3;
}

/* ------------------------------------------------------------------
   Quick analysis
   ------------------------------------------------------------------ */

export interface QuickInput {
  kind: "article" | "country" | "feed";
  window: WindowKey;
  article?: Article;
  iso2?: string;
  filters?: { countries?: string[]; regions?: string[]; themes?: ThemeId[]; q?: string };
  withStats?: boolean;
}

export async function runQuick(input: QuickInput): Promise<{ report: Quick; meta: Omit<FinalMeta, "scope" | "perTarget" | "toppedUp"> & { kind: string } }> {
  const store = getStore();
  const now = new Date();
  let label = "";
  let evidence: EvidenceItem[] = [];
  let baselines: Baseline[] = [];
  let statsDigest: string | undefined;
  const since = sinceISO(input.window);
  if (input.kind === "article" && input.article) {
    const a = input.article;
    label = a.title.slice(0, 120);
    const related = await store.queryArticles({ sinceISO: sinceISO("7d"), countries: a.countries.length ? a.countries.slice(0, 2) : undefined, themes: !a.countries.length && a.themes.length ? a.themes.slice(0, 2) : undefined, limit: 200 });
    const rel = selectEvidence(related.filter((r) => r.id !== a.id), { max: 6, perFamily: 2, startN: 2 });
    evidence = [{ n: 1, article: a, bandUsed: a.band, pinned: true }, ...rel];
    baselines = await baselinesFor(a.countries.slice(0, 1));
  } else if (input.kind === "country" && input.iso2 && BY_ISO2[input.iso2]) {
    label = BY_ISO2[input.iso2].name;
    const { articles } = await gatherCandidates({ type: "country", id: input.iso2 }, input.window);
    evidence = selectEvidence(articles, { max: 16, perFamily: 3 });
    baselines = await baselinesFor([input.iso2]);
  } else if (input.kind === "feed") {
    const f = input.filters ?? {};
    const arts = await store.queryArticles({ sinceISO: since, countries: f.countries, regions: f.regions, themes: f.themes, q: f.q, limit: 800 });
    const parts = [f.countries?.map((c) => BY_ISO2[c]?.name ?? c).join(", "), f.regions?.join(", "), f.themes?.map(themeLabel).join(", "), f.q ? `search "${f.q}"` : ""].filter(Boolean);
    label = parts.length ? parts.join("; ") : "all sources, all regions";
    evidence = selectEvidence(arts, { max: 24, perFamily: 3, perCountry: 5 });
    if (input.withStats) {
      const agg = aggregate(arts, WINDOW_HOURS[input.window]);
      statsDigest = [
        `items in filtered set: ${agg.total}; distinct sources: ${agg.sources}; independent outlet families: ${agg.independentStreams}`,
        `top countries by tagged items: ${agg.byCountry.slice(0, 6).map((c) => `${BY_ISO2[c.iso2]?.name ?? c.iso2} ${c.n}`).join(", ")}`,
        `theme counts: ${agg.byTheme.map((t) => `${themeLabel(t.id)} ${t.n}`).join(", ")}`,
        `source concentration (HHI 0 to 1): ${agg.hhi.toFixed(3)}; largest single source share: ${Math.round(agg.topShare * 100)}%`,
        `band mix: green ${agg.byBand.green}, amber ${agg.byBand.amber}, unrated ${agg.byBand.unrated}`,
      ].join("\n");
    }
  } else {
    throw new Error("Nothing to analyse for that request.");
  }
  if (!evidence.length) throw new Error("No evidence items are available for this request yet. Refresh the sources and try again.");
  const metrics = computeMetrics(evidence);
  const ceiling = confidenceCeiling(metrics);
  const system = `${KERNEL}\n\n${QUICK_SYSTEM_NOTE}`;
  const user = quickUser({ kind: input.kind, label, window: input.window, evidence, baselines, metrics, ceiling, statsDigest, now });
  const res = await complete({ system, user, maxTokens: 2200, effort: "low", temperature: 0.2, schema: { name: "qap_quick", schema: jsonSchemaOf(QuickSchema) } });
  const { data, usageExtra } = await parseWithRepair(QuickSchema, "qap_quick", res.text, system);
  const clean = deepSanitize(data);
  const audited = auditCitations(clean, evidence.length, baselines.length, ["points", "headline"]);
  const report = audited.report;
  const adj = applyCeiling(report.confidence, metrics);
  report.confidence = adj.band;
  return {
    report,
    meta: {
      kind: input.kind,
      id: `quick-${now.getTime()}`,
      label,
      window: input.window,
      generatedAt: now.toISOString(),
      model: env.inceptionModel,
      usage: { prompt: res.usage.prompt + usageExtra.prompt, completion: res.usage.completion + usageExtra.completion },
      metrics,
      ceiling,
      confidenceAdjusted: { modelBand: data.confidence, appliedBand: adj.band, capped: adj.capped, reason: adj.reason },
      citation: audited.stats,
      baselines,
      references: buildReferences(evidence),
    },
  };
}

const QUICK_SYSTEM_NOTE = "This is a quick analysis task. Keep every field short and cited.";
