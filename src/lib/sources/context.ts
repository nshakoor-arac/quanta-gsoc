import type { Baseline } from "../types";
import { baselinesFor as worldBankBaselinesFor } from "./worldbank";
import { hapiBaselinesFor } from "./hapi";

/**
 * Structural and humanitarian context for QAP analysis.
 * Current-event source evidence remains in Article/EvidenceItem and is not mixed into this layer.
 */
export async function baselinesFor(iso2s: string[]): Promise<Baseline[]> {
  const [worldBank, hapi] = await Promise.all([
    worldBankBaselinesFor(iso2s),
    hapiBaselinesFor(iso2s),
  ]);

  // Re-number after combining sources so B-series citations remain contiguous.
  return [...worldBank, ...hapi].map((b, i) => ({ ...b, code: `B${i + 1}` }));
}
