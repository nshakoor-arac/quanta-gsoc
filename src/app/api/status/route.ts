import { NextResponse } from "next/server";
import { configStatus, env } from "@/lib/env";
import { getStore } from "@/lib/store";
import { FEEDS } from "@/lib/sources/registry";
import { aiBudget } from "@/lib/server/guard";
import { currentSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = getStore();
  const session = await currentSession();
  const [total, last, log, budget] = await Promise.all([
    store.countArticles().catch(() => -1),
    store.latestFetch().catch(() => null),
    store.recentIngest(60).catch(() => []),
    aiBudget(),
  ]);
  // Latest result per source
  const latest = new Map<string, (typeof log)[number]>();
  for (const l of log) if (!latest.has(l.source)) latest.set(l.source, l);
  const rssDetail = (log.find((l) => l.source === "rss")?.detail ?? []) as { id: string; ok: boolean; count: number; error?: string }[];
  return NextResponse.json({
    analyst: session?.analyst ?? "Analyst",
    config: configStatus(),
    store: store.kind,
    articles: total,
    lastFetch: last,
    ai: { model: env.inceptionModel, effort: env.reasoningEffort, used: budget.used, limit: budget.limit },
    feeds: FEEDS.map((f) => ({ id: f.id, name: f.name, type: f.type, band: f.band, ok: rssDetail.find((d) => d.id === f.id)?.ok ?? null, count: rssDetail.find((d) => d.id === f.id)?.count ?? null, error: rssDetail.find((d) => d.id === f.id)?.error ?? null })),
    sources: [...latest.values()].map((l) => ({ source: l.source, ok: l.ok, count: l.count, at: l.createdAt, error: (l.detail as { error?: string } | undefined)?.error })),
  });
}
