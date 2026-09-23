import { NextResponse, after } from "next/server";
import { z } from "zod";
import { WINDOW_HOURS, type WindowKey } from "@/lib/types";
import { getStore } from "@/lib/store";
import { refreshIfStale } from "@/lib/sources/ingest";
import { WindowZ } from "@/lib/ai/inputs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Q = z.object({ window: WindowZ.default("72h"), limit: z.coerce.number().int().min(50).max(3000).default(1800) });

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = Q.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Bad query" }, { status: 400 });
  const { window, limit } = parsed.data;
  const store = getStore();
  try {
    let count = await store.countArticles();
    let refreshed = false;
    if (count === 0) {
      refreshed = await refreshIfStale();
      count = await store.countArticles();
    } else {
      after(async () => {
        try {
          await refreshIfStale();
        } catch {
          /* background refresh is best-effort */
        }
      });
    }
    const since = new Date(Date.now() - WINDOW_HOURS[window as WindowKey] * 3600000).toISOString();
    const items = await store.queryArticles({ sinceISO: since, limit });
    return NextResponse.json({
      items,
      meta: { store: store.kind, total: count, window, lastFetch: await store.latestFetch(), refreshed, warming: items.length === 0 },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
