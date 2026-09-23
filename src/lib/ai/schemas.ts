import { z } from "zod";

/**
 * Report schemas. Kept free of min/max constraints so the same definition can be sent to the model as a
 * JSON schema (structured outputs). Counts and quality rules are enforced in code after parsing.
 * Every free-text string may carry inline citation markers: [3] for evidence, [B2] for structural baselines.
 */
export const ThreatLevel = z.enum(["critical", "high", "elevated", "moderate", "low"]);
export const ConfBand = z.enum(["high", "moderate", "low"]);
export const Horizon = z.enum(["0-72H", "3-30D", "30-180D"]);

const Confidence = z.object({
  band: ConfBand,
  reasons: z.array(z.string()),
  flip_risks: z.array(z.string()),
});

const Assumption = z.object({
  id: z.string(),
  assumption: z.string(),
  why_it_matters: z.string(),
  risk_if_wrong: z.string(),
});

const Indicator = z.object({
  indicator: z.string(),
  direction: z.enum(["rising", "falling", "stable", "watch"]),
  threshold: z.string(),
  cadence: z.string(),
});

const Action = z.object({ horizon: Horizon, action: z.string() });

export const SitrepSchema = z.object({
  title: z.string(),
  key_judgment: z.string(),
  threat_level: ThreatLevel,
  threat_rationale: z.string(),
  snapshot: z.array(z.object({ figure: z.string(), label: z.string() })),
  situation_overview: z.string(),
  key_developments: z.array(z.string()),
  assessment: z.string(),
  strategic_implications: z.string(),
  priority_points: z.array(z.string()),
  actor_dynamics: z.array(z.string()),
  risks: z.array(z.object({ risk: z.string(), likelihood: z.number(), impact: z.number(), mitigant: z.string() })),
  action_items: z.array(Action),
  collection_gaps: z.array(z.string()),
  near_term_outlook: z.array(z.object({ scenario: z.enum(["best", "base", "worst"]), probability_band: z.string(), description: z.string(), trigger: z.string() })),
  know: z.array(z.string()),
  assess: z.array(z.string()),
  unknown: z.array(z.string()),
  assumptions: z.array(Assumption),
  indicators: z.array(Indicator),
  confidence: Confidence,
});
export type Sitrep = z.infer<typeof SitrepSchema>;

export const CompareSchema = z.object({
  title: z.string(),
  key_judgment: z.string(),
  threat_level: ThreatLevel,
  targets: z.array(z.object({ name: z.string(), threat_level: ThreatLevel, rationale: z.string() })),
  matrix: z.array(
    z.object({
      dimension: z.string(),
      cells: z.array(z.object({ target: z.string(), rating: z.enum(["high", "elevated", "moderate", "low", "unclear"]), note: z.string() })),
    })
  ),
  convergences: z.array(z.string()),
  divergences: z.array(z.string()),
  ranking: z.array(z.object({ rank: z.number(), target: z.string(), rationale: z.string() })),
  implications: z.string(),
  action_items: z.array(Action),
  collection_gaps: z.array(z.string()),
  know: z.array(z.string()),
  assess: z.array(z.string()),
  unknown: z.array(z.string()),
  indicators: z.array(Indicator),
  confidence: Confidence,
});
export type Compare = z.infer<typeof CompareSchema>;

export const QuickSchema = z.object({
  headline: z.string(),
  points: z.array(z.string()),
  five_w: z.object({ who: z.string(), what: z.string(), where: z.string(), when: z.string(), why: z.string(), how: z.string() }),
  so_what: z.string(),
  watch: z.array(z.string()),
  confidence: ConfBand,
  caveats: z.array(z.string()),
});
export type Quick = z.infer<typeof QuickSchema>;

export function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(schema) as Record<string, unknown>;
  delete js.$schema;
  return js;
}
