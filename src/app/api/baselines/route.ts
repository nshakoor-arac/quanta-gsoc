import { NextResponse } from "next/server";
import { WGI, wgiTable } from "@/lib/sources/worldbank";
import { BY_ISO2 } from "@/lib/geo/countries";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const iso = (new URL(req.url).searchParams.get("iso2") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => BY_ISO2[s])
    .slice(0, 6);
  const table = await wgiTable();
  if (!table) return NextResponse.json({ indicators: WGI.map((w) => ({ key: w.key, label: w.label })), rows: {}, unavailable: true });
  const rows: Record<string, Record<string, { value: number; year: string }>> = {};
  for (const c of iso) if (table[c]) rows[c] = table[c];
  return NextResponse.json({ indicators: WGI.map((w) => ({ key: w.key, label: w.label })), rows, source: "World Bank, Worldwide Governance Indicators (governance score, 0 to 100, higher is better). Annual and lagged." });
}
