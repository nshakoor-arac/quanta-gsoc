/** Text hygiene for model output and JSON extraction. */

/** House style forbids em dashes. Replace them with clause punctuation and normalise en dashes in ranges. */
export function noDashes(s: string): string {
  return s
    .replace(/\s*\u2014\s*/g, ", ")
    .replace(/(\d)\s*\u2013\s*(\d)/g, "$1 to $2")
    .replace(/\s*\u2013\s*/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/\s{2,}/g, " ");
}

/** Turns "[1, 2]" or "[B1; B2]" into "[1][2]" so every marker is a single-citation token. */
export function normCites(s: string): string {
  return s.replace(/\[((?:B?\d{1,3})(?:\s*[,;]\s*B?\d{1,3})+)\]/g, (_m, list: string) =>
    list
      .split(/\s*[,;]\s*/)
      .map((x) => `[${x}]`)
      .join("")
  );
}

export function deepSanitize<T>(v: T): T {
  if (typeof v === "string") return normCites(noDashes(v)) as unknown as T;
  if (Array.isArray(v)) return v.map(deepSanitize) as unknown as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = deepSanitize(x);
    return out as T;
  }
  return v;
}

/** Extracts the first JSON object from model text, tolerating markdown fences and stray prose. */
export function extractJson(text: string): unknown {
  let t = text.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model did not return a JSON object");
  return JSON.parse(t.slice(start, end + 1));
}

const CITE = /\[(B?\d{1,3})\]/g;

export function citesIn(s: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(CITE.source, "g");
  while ((m = re.exec(s))) out.push(m[1]);
  return out;
}

export interface CiteStats {
  statements: number;
  cited: number;
  invalidRemoved: number;
  uncited: string[];
}

/**
 * Walks the report, removes citation markers that point to nothing, and counts factual statements
 * (array items and prose fields) that carry at least one valid marker.
 */
export function auditCitations<T>(report: T, maxN: number, maxB: number, statementPaths: string[]): { report: T; stats: CiteStats } {
  let invalid = 0;
  const valid = (id: string) => (id.startsWith("B") ? Number(id.slice(1)) >= 1 && Number(id.slice(1)) <= maxB : Number(id) >= 1 && Number(id) <= maxN);
  const fix = (s: string) =>
    s
      .replace(/\[(B?\d{1,3})\]/g, (m, id) => {
        if (valid(id)) return m;
        invalid++;
        return "";
      })
      .replace(/\[(?:B)?n\]/gi, () => {
        invalid++;
        return "";
      });
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return fix(v).replace(/\s{2,}/g, " ").trim();
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  const cleaned = walk(report) as Record<string, unknown>;
  let statements = 0;
  let cited = 0;
  const uncited: string[] = [];
  const check = (label: string, text: string) => {
    if (!text || text.length < 12) return;
    statements++;
    if (citesIn(text).length) cited++;
    else uncited.push(`${label}: ${text.slice(0, 90)}`);
  };
  const checkValue = (label: string, v: unknown) => {
    if (typeof v === "string") check(label, v);
    else if (Array.isArray(v)) v.forEach((x, i) => checkValue(`${label}[${i}]`, x));
    else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) checkValue(`${label}.${k}`, x);
    }
  };
  for (const p of statementPaths) checkValue(p, cleaned[p]);
  return { report: cleaned as T, stats: { statements, cited, invalidRemoved: invalid, uncited } };
}
