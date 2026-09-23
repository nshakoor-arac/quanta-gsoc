import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getStore } from "@/lib/store";
import { CompareReqZ } from "@/lib/ai/inputs";
import { finaliseCompare, prepareCompare, validateTarget } from "@/lib/ai/sitrep";
import { CompareSchema, jsonSchemaOf } from "@/lib/ai/schemas";
import { stream, type Usage } from "@/lib/ai/mercury";
import { sseResponse } from "@/lib/server/sse";
import { aiBudget } from "@/lib/server/guard";
import { currentSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const parsed = CompareReqZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request: " + parsed.error.issues[0]?.message }, { status: 400 });
  const body = parsed.data;
  for (const t of body.targets) {
    const bad = validateTarget(t);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  }
  const types = new Set(body.targets.map((t) => t.type));
  if (types.size > 1 || types.has("global")) return NextResponse.json({ error: "Compare targets of one kind: countries, regions or themes." }, { status: 400 });
  const keys = body.targets.map((t) => `${t.type}:${t.id}:${t.within?.id ?? ""}`);
  if (new Set(keys).size !== keys.length) return NextResponse.json({ error: "Choose different targets to compare." }, { status: 400 });
  if (!env.inceptionKey) return NextResponse.json({ error: "The AI key is not set. Add INCEPTION_API_KEY in your environment settings." }, { status: 503 });
  const budget = await aiBudget();
  if (!budget.ok) return NextResponse.json({ error: `Daily AI limit reached (${budget.used} of ${budget.limit}).` }, { status: 429 });
  const session = await currentSession();
  const analyst = session?.analyst ?? "Analyst";

  return sseResponse(async (send, signal) => {
    send("stage", { stage: "collect", message: "Collecting evidence for each target" });
    const prep = await prepareCompare(body.targets, body.window, body.pinned);
    const thin = prep.perTarget.filter((p) => p.items < 3);
    if (thin.length) throw new Error(`Not enough evidence for: ${thin.map((t) => `${t.label} (${t.items})`).join(", ")}. Widen the window or refresh sources.`);
    send("prepared", { id: prep.id, label: prep.label, evidence: prep.evidence.length, streams: prep.metrics.independentStreams, ceiling: prep.ceiling, perTarget: prep.perTarget, toppedUp: prep.toppedUp, baselines: prep.baselines.length });
    send("stage", { stage: "draft", message: "Mercury is drafting the comparison" });
    let raw = "";
    let usage: Usage = { prompt: 0, completion: 0 };
    for await (const ev of stream({ system: prep.system, user: prep.user, maxTokens: 7500, effort: body.effort, temperature: 0.25, schema: { name: "qap_compare", schema: jsonSchemaOf(CompareSchema) }, signal })) {
      if (ev.type === "delta") {
        raw += ev.text;
        send("delta", { text: ev.text });
      } else usage = ev.usage;
    }
    send("stage", { stage: "validate", message: "Checking citations and confidence" });
    const { report, meta } = await finaliseCompare(prep, raw, usage);
    const store = getStore();
    const saved = await store.saveReport({ analyst, kind: "compare", title: report.title, scope: { targets: prep.targets, window: prep.window }, report, evidence: meta.references, meta });
    await store.logAi("compare", analyst, meta.model, meta.usage.prompt, meta.usage.completion).catch(() => undefined);
    send("done", { id: saved.id, report, meta, analyst, createdAt: saved.createdAt });
  }, req.signal);
}
