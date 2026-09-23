import { cookies } from "next/headers";
import { COOKIE, verifySession, type Session } from "../auth";
import { env } from "../env";

/** Returns the current session, or a local-dev pseudo session when auth is not configured outside production. */
export async function currentSession(): Promise<Session | null> {
  const store = await cookies();
  const s = await verifySession(env.sessionSecret, store.get(COOKIE)?.value);
  if (s) return s;
  if (!env.isProd && (!env.accessCode || env.sessionSecret.length < 32)) return { analyst: "Local analyst", exp: 0 };
  return null;
}
