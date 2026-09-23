import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getStore } from "@/lib/store";
import { ingestGdelt, ingestReliefweb, ingestRss } from "@/lib/sources/ingest";
import { THEMES } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Scheduled refresh. Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" automatically. */
export async function GET(req: Request) {
  if (!env.cronSecret) return NextResponse.json({ error: "CRON_SECRET is not set; scheduled refresh is disabled." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const t0 = Date.now();
  const out: unknown[] = [];
  out.push(await ingestRss());
  if (env.reliefwebAppname) out.push(await ingestReliefweb());
  for (const t of THEMES) {
    if (Date.now() - t0 > 95000) break;
    out.push(await ingestGdelt({ kind: "theme", theme: t.id, timespan: "72h" }));
  }
  await getStore().prune(45);
  return NextResponse.json({ ok: true, ms: Date.now() - t0, results: out });
}
