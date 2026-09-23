import type { Compare, Sitrep } from "@/lib/ai/schemas";
import type { FinalMeta } from "@/lib/ai/sitrep";
import { BRAND } from "@/lib/brand";

const L = (a: string[]) => a.map((x) => `- ${x}`).join("\n");

export function reportToMarkdown(kind: "sitrep" | "compare", r: Sitrep | Compare, meta: FinalMeta, analyst: string, createdAt: string): string {
  const out: string[] = [];
  out.push(`# ${r.title}`);
  out.push(`${BRAND.producer} | ${meta.id} | Prepared by ${analyst} | ${createdAt}`);
  out.push(`Threat level: **${r.threat_level.toUpperCase()}** | Confidence: **${meta.confidenceAdjusted.appliedBand}** | Window: ${meta.window}`);
  out.push(`## Bottom line up front\n${r.key_judgment}`);
  if (kind === "sitrep") {
    const s = r as Sitrep;
    out.push(`## Threat rationale\n${s.threat_rationale}`);
    out.push(`## Snapshot\n${L(s.snapshot.map((x) => `${x.figure}: ${x.label}`))}`);
    out.push(`## Situation overview\n${s.situation_overview}`);
    out.push(`## Key developments\n${L(s.key_developments)}`);
    out.push(`## Assessment\n${s.assessment}`);
    out.push(`## Strategic implications\n${s.strategic_implications}`);
    out.push(`## Priority intelligence points\n${L(s.priority_points)}`);
    out.push(`## Actor dynamics\n${L(s.actor_dynamics)}`);
    out.push(`## Risks\n| Risk | Likelihood (1-5) | Impact (1-5) | Mitigant |\n|---|---|---|---|\n${s.risks.map((x) => `| ${x.risk} | ${x.likelihood} | ${x.impact} | ${x.mitigant} |`).join("\n")}`);
    out.push(`## Near-term outlook\n${L(s.near_term_outlook.map((x) => `**${x.scenario}** (${x.probability_band}): ${x.description} Trigger: ${x.trigger}`))}`);
    out.push(`## Assumptions\n${L(s.assumptions.map((x) => `${x.id}: ${x.assumption} Why it matters: ${x.why_it_matters} If wrong: ${x.risk_if_wrong}`))}`);
  } else {
    const c = r as Compare;
    out.push(`## Targets\n${L(c.targets.map((t) => `**${t.name}** (${t.threat_level}): ${t.rationale}`))}`);
    out.push(`## Ranking\n${L(c.ranking.map((t) => `${t.rank}. ${t.target}: ${t.rationale}`))}`);
    out.push(`## Convergences\n${L(c.convergences)}`);
    out.push(`## Divergences\n${L(c.divergences)}`);
    out.push(`## Implications\n${c.implications}`);
  }
  out.push(`## Action items\n${L(r.action_items.map((a) => `[${a.horizon}] ${a.action}`))}`);
  out.push(`## Know / Assess / Unknown\n**Know**\n${L(r.know)}\n\n**Assess**\n${L(r.assess)}\n\n**Unknown**\n${L(r.unknown)}`);
  out.push(`## Indicators\n${L(r.indicators.map((i) => `${i.indicator} (${i.direction}). Threshold: ${i.threshold}. Cadence: ${i.cadence}`))}`);
  out.push(`## Collection gaps\n${L(r.collection_gaps)}`);
  out.push(`## Confidence\n${r.confidence.band}. ${meta.confidenceAdjusted.reason}\n${L(r.confidence.reasons)}\n\nWhat would change this:\n${L(r.confidence.flip_risks)}`);
  if (meta.baselines.length) out.push(`## Structural baselines\n${L(meta.baselines.map((b) => `[${b.code}] ${b.label}, ${b.iso2}: ${b.value} (${b.year}). ${b.source}`))}`);
  out.push(`## Reference register\n${meta.references.map((x) => `[${x.n}] ${x.title}. ${x.source} (${x.type}, band ${x.band}), ${x.publishedAt.slice(0, 10)}. ${x.url}`).join("\n")}`);
  out.push(`---\n${BRAND.legal}`);
  return out.join("\n\n").replace(/\u2014|\u2013/g, ", ");
}
