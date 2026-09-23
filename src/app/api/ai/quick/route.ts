import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getStore } from "@/lib/store";
import { QuickReqZ } from "@/lib/ai/inputs";
import { runQuick } from "@/lib/ai/sitrep";
import { aiBudget } from "@/lib/server/guard";
import { currentSession } from "@/lib/server/session";
import type { Article } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(req: Request) {
  const parsed = QuickReqZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request: " + parsed.error.issues[0]?.message }, { status: 400 });
  const b = parsed.data;
  if (!env.inceptionKey) return NextResponse.json({ error: "The AI key is not set. Add INCEPTION_API_KEY in your environment settings." }, { status: 503 });
  const budget = await aiBudget();
  if (!budget.ok) return NextResponse.json({ error: `Daily AI limit reached (${budget.used} of ${budget.limit}).` }, { status: 429 });
  const session = await currentSession();
  try {
    const out = await runQuick({ kind: b.kind, window: b.window, article: b.article as Article | undefined, iso2: b.iso2?.toUpperCase(), filters: b.filters, withStats: b.withStats });
    await getStore().logAi(`quick:${b.kind}`, session?.analyst ?? "Analyst", out.meta.model, out.meta.usage.prompt, out.meta.usage.completion).catch(() => undefined);
    return NextResponse.json(out);
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json({ error: msg }, { status: /No evidence|Nothing to analyse/.test(msg) ? 422 : 502 });
  }
}
