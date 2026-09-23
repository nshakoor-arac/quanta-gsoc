import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getStore } from "@/lib/store";
import { SitrepReqZ } from "@/lib/ai/inputs";
import { finaliseSitrep, prepareSitrep, validateTarget } from "@/lib/ai/sitrep";
import { jsonSchemaOf, SitrepSchema } from "@/lib/ai/schemas";
import { stream, type Usage } from "@/lib/ai/mercury";
import { sseResponse } from "@/lib/server/sse";
import { aiBudget } from "@/lib/server/guard";
import { currentSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const parsed = SitrepReqZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request: " + parsed.error.issues[0]?.message }, { status: 400 });
  const body = parsed.data;
  const bad = validateTarget(body.scope);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  if (!env.inceptionKey) return NextResponse.json({ error: "The AI key is not set. Add INCEPTION_API_KEY in your environment settings." }, { status: 503 });
  const budget = await aiBudget();
  if (!budget.ok) return NextResponse.json({ error: `Daily AI limit reached (${budget.used} of ${budget.limit}). Raise AI_DAILY_LIMIT to allow more.` }, { status: 429 });
  const session = await currentSession();
  const analyst = session?.analyst ?? "Analyst";

  return sseResponse(async (send, signal) => {
    send("stage", { stage: "collect", message: "Collecting and ranking evidence" });
    const prep = await prepareSitrep(body.scope, body.window, body.pinned);
    if (prep.evidence.length < 3) {
      throw new Error(`Only ${prep.evidence.length} evidence item(s) found for ${prep.label} in this window. Widen the time window, refresh sources, or pin items, then try again.`);
    }
    send("prepared", { id: prep.id, label: prep.label, evidence: prep.evidence.length, streams: prep.metrics.independentStreams, ceiling: prep.ceiling, toppedUp: prep.toppedUp, baselines: prep.baselines.length });
    send("stage", { stage: "draft", message: "Mercury is drafting the SitRep" });
    let raw = "";
    let usage: Usage = { prompt: 0, completion: 0 };
    for await (const ev of stream({ system: prep.system, user: prep.user, maxTokens: 7500, effort: body.effort, temperature: 0.25, schema: { name: "qap_sitrep", schema: jsonSchemaOf(SitrepSchema) }, signal })) {
      if (ev.type === "delta") {
        raw += ev.text;
        send("delta", { text: ev.text });
      } else usage = ev.usage;
    }
    send("stage", { stage: "validate", message: "Checking citations and confidence" });
    const { report, meta } = await finaliseSitrep(prep, raw, usage);
    const store = getStore();
    const saved = await store.saveReport({ analyst, kind: "sitrep", title: report.title, scope: { targets: prep.targets, window: prep.window }, report, evidence: meta.references, meta });
    await store.logAi("sitrep", analyst, meta.model, meta.usage.prompt, meta.usage.completion).catch(() => undefined);
    send("done", { id: saved.id, report, meta, analyst, createdAt: saved.createdAt });
  }, req.signal);
}
