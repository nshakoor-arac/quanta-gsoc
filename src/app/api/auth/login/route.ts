import { NextResponse } from "next/server";
import { z } from "zod";
import { COOKIE, createSession, safeEqual } from "@/lib/auth";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const Body = z.object({ code: z.string().min(1).max(200), name: z.string().trim().max(60).optional() });

// Very small brute-force guard: 8 failures per IP per 10 minutes (per server instance).
const fails = new Map<string, { n: number; first: number }>();
function limited(ip: string): boolean {
  const e = fails.get(ip);
  if (!e) return false;
  if (Date.now() - e.first > 10 * 60 * 1000) {
    fails.delete(ip);
    return false;
  }
  return e.n >= 8;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (env.sessionSecret.length < 32 || env.accessCode.length < 8) {
    return NextResponse.json({ error: "Server not configured: set APP_ACCESS_CODE (8+ chars) and SESSION_SECRET (32+ chars)." }, { status: 503 });
  }
  if (limited(ip)) return NextResponse.json({ error: "Too many attempts. Wait 10 minutes and try again." }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter the access code." }, { status: 400 });
  const ok = await safeEqual(parsed.data.code, env.accessCode);
  if (!ok) {
    const e = fails.get(ip) ?? { n: 0, first: Date.now() };
    e.n++;
    fails.set(ip, e);
    return NextResponse.json({ error: "That access code is not correct." }, { status: 401 });
  }
  fails.delete(ip);
  const { token, maxAge } = await createSession(env.sessionSecret, parsed.data.name || "Analyst");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: env.isProd, path: "/", maxAge });
  return res;
}
