import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, verifySession } from "@/lib/auth";

const PUBLIC_PREFIXES = ["/login", "/api/auth/", "/api/health", "/api/cron/", "/_next/", "/favicon", "/logo.png", "/icon.svg"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return NextResponse.next();

  const secret = process.env.SESSION_SECRET ?? "";
  const code = process.env.APP_ACCESS_CODE ?? "";
  const configured = secret.length >= 32 && code.length >= 8;

  if (!configured) {
    // Fail closed in production. In local development, allow through so setup is possible.
    if (process.env.NODE_ENV === "production") {
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Server is not configured. Set APP_ACCESS_CODE and SESSION_SECRET." }, { status: 503 });
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "?notice=unconfigured";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const session = await verifySession(secret, req.cookies.get(COOKIE)?.value);
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
