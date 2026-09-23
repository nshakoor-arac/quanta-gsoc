import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestGdelt, ingestReliefweb, ingestRss } from "@/lib/sources/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Theme = z.enum(["conflict", "terrorism", "unrest", "governance", "humanitarian", "migration", "economic", "cyber", "hazard"]);
const Body = z.discriminatedUnion("job", [
  z.object({ job: z.literal("rss") }),
  z.object({ job: z.literal("reliefweb"), iso2: z.string().max(2).optional() }),
  z.object({ job: z.literal("gdelt-theme"), theme: Theme, timespan: z.enum(["24h", "72h", "7d", "30d"]).optional() }),
  z.object({ job: z.literal("gdelt-country"), iso2: z.string().length(2), timespan: z.enum(["24h", "72h", "7d", "30d"]).optional() }),
  z.object({ job: z.literal("gdelt-region"), region: z.string().max(60), timespan: z.enum(["24h", "72h", "7d", "30d"]).optional() }),
]);

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const b = parsed.data;
  try {
    const r =
      b.job === "rss"
        ? await ingestRss()
        : b.job === "reliefweb"
          ? await ingestReliefweb(b.iso2)
          : b.job === "gdelt-theme"
            ? await ingestGdelt({ kind: "theme", theme: b.theme, timespan: b.timespan })
            : b.job === "gdelt-country"
              ? await ingestGdelt({ kind: "country", iso2: b.iso2.toUpperCase(), timespan: b.timespan })
              : await ingestGdelt({ kind: "region", region: b.region, timespan: b.timespan });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
