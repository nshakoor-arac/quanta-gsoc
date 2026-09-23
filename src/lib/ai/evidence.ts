import type { Article, Band, ConfidenceBand, EvidenceItem } from "../types";

/* ------------------------------------------------------------------
   Independence handling (WSI rule): several outlets carrying the same upstream story
   count as ONE stream. We approximate this with title similarity and outlet family.
   ------------------------------------------------------------------ */

const STOP = new Set("the a an of in on at to for and or with by from as is are was were be been has have had this that it its after over into amid says said say new report reports".split(" "));

function tokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP.has(t))
  );
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Groups near-identical headlines. Returns cluster index per article. */
export function clusterTitles(items: Article[], threshold = 0.8): number[] {
  const toks = items.map((a) => tokens(a.title));
  const cl: number[] = items.map((_, i) => i);
  const find = (x: number): number => (cl[x] === x ? x : (cl[x] = find(cl[x])));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (jaccard(toks[i], toks[j]) >= threshold) cl[find(j)] = find(i);
    }
  }
  return items.map((_, i) => find(i));
}

/** Independent streams: distinct outlet families, merged where a syndicated story links two families. */
export function independentStreams(items: Article[]): number {
  const usable = items.filter((a) => a.sourceType !== "state-media");
  if (!usable.length) return 0;
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    const p = parent.get(x)!;
    if (p === x) return x;
    const r = find(p);
    parent.set(x, r);
    return r;
  };
  const union = (a: string, b: string) => {
    parent.set(find(a), find(b));
  };
  for (const a of usable) find(a.family);
  const cl = clusterTitles(usable);
  const first = new Map<number, string>();
  usable.forEach((a, i) => {
    const c = cl[i];
    if (first.has(c)) union(first.get(c)!, a.family);
    else first.set(c, a.family);
  });
  return new Set(usable.map((a) => find(a.family))).size;
}

/* ------------------------------------------------------------------
   Evidence selection
   ------------------------------------------------------------------ */

const BAND_W: Record<Band, number> = { green: 1, amber: 0.7, unrated: 0.45, red: 0.1 };

export interface SelectOpts {
  max: number;
  pinned?: { article: Article; band?: Band }[];
  perFamily?: number;
  perCountry?: number;
  startN?: number;
}

export function selectEvidence(candidates: Article[], opts: SelectOpts): EvidenceItem[] {
  const now = Date.now();
  const perFamily = opts.perFamily ?? 4;
  const perCountry = opts.perCountry ?? 999;
  const chosen: { a: Article; band: Band; pinned: boolean }[] = [];
  const seen = new Set<string>();
  for (const p of opts.pinned ?? []) {
    if (seen.has(p.article.id)) continue;
    seen.add(p.article.id);
    chosen.push({ a: p.article, band: p.band ?? p.article.band, pinned: true });
  }
  const pool = candidates.filter((a) => !seen.has(a.id));
  const clusters = clusterTitles([...chosen.map((c) => c.a), ...pool]);
  const clusterOf = new Map<string, number>();
  [...chosen.map((c) => c.a), ...pool].forEach((a, i) => clusterOf.set(a.id, clusters[i]));
  const usedClusters = new Set(chosen.map((c) => clusterOf.get(c.a.id)!));
  const famCount = new Map<string, number>();
  const ctyCount = new Map<string, number>();
  for (const c of chosen) famCount.set(c.a.family, (famCount.get(c.a.family) ?? 0) + 1);
  const score = (a: Article) => {
    const ageH = Math.max(0, (now - new Date(a.publishedAt).getTime()) / 3600000);
    const recency = 1 / (1 + ageH / 36);
    return BAND_W[a.band] * 0.55 + recency * 0.35 + Math.min(a.themes.length, 3) * 0.033 + (a.excerpt ? 0.05 : 0);
  };
  const ranked = [...pool].sort((x, y) => score(y) - score(x));
  for (const a of ranked) {
    if (chosen.length >= opts.max) break;
    const cl = clusterOf.get(a.id)!;
    if (usedClusters.has(cl)) continue;
    if ((famCount.get(a.family) ?? 0) >= perFamily) continue;
    const top = a.countries[0];
    if (top && (ctyCount.get(top) ?? 0) >= perCountry) continue;
    usedClusters.add(cl);
    famCount.set(a.family, (famCount.get(a.family) ?? 0) + 1);
    if (top) ctyCount.set(top, (ctyCount.get(top) ?? 0) + 1);
    chosen.push({ a, band: a.band, pinned: false });
  }
  const start = opts.startN ?? 1;
  return chosen.map((c, i) => ({ n: start + i, article: c.a, bandUsed: c.band, pinned: c.pinned }));
}

/* ------------------------------------------------------------------
   Metrics and the confidence ceiling
   ------------------------------------------------------------------ */

export interface EvidenceMetrics {
  items: number;
  independentStreams: number;
  sourceTypes: number;
  greenShare: number;
  stateMediaItems: number;
  oldest: string | null;
  newest: string | null;
  byAggregator: Record<string, number>;
  pinned: number;
}

export function computeMetrics(ev: EvidenceItem[]): EvidenceMetrics {
  const arts = ev.map((e) => e.article);
  const times = arts.map((a) => a.publishedAt).sort();
  const byAgg: Record<string, number> = {};
  for (const a of arts) byAgg[a.aggregator] = (byAgg[a.aggregator] ?? 0) + 1;
  return {
    items: ev.length,
    independentStreams: independentStreams(arts),
    sourceTypes: new Set(arts.map((a) => a.sourceType)).size,
    greenShare: ev.length ? ev.filter((e) => e.bandUsed === "green").length / ev.length : 0,
    stateMediaItems: arts.filter((a) => a.sourceType === "state-media").length,
    oldest: times[0] ?? null,
    newest: times[times.length - 1] ?? null,
    byAggregator: byAgg,
    pinned: ev.filter((e) => e.pinned).length,
  };
}

const ORDER: ConfidenceBand[] = ["low", "moderate", "high"];

/** Highest confidence the evidence base can support, independent of what the model claims. */
export function confidenceCeiling(m: EvidenceMetrics): { band: ConfidenceBand; reason: string } {
  if (m.items < 3 || m.independentStreams < 2) return { band: "low", reason: `only ${m.independentStreams} independent stream(s) across ${m.items} item(s)` };
  if (m.independentStreams < 4 || m.items < 8) return { band: "moderate", reason: `${m.independentStreams} independent streams across ${m.items} items is below the threshold for high confidence (4 streams, 8 items)` };
  if (m.greenShare < 0.3) return { band: "moderate", reason: "fewer than 30 percent of items are in the Green band" };
  return { band: "high", reason: "evidence base meets the high-confidence threshold (4+ independent streams, 8+ items, 30%+ Green)" };
}

export function applyCeiling(claimed: ConfidenceBand, m: EvidenceMetrics): { band: ConfidenceBand; capped: boolean; reason: string } {
  const c = confidenceCeiling(m);
  const capped = ORDER.indexOf(claimed) > ORDER.indexOf(c.band);
  return { band: capped ? c.band : claimed, capped, reason: c.reason };
}
