/** Signed-cookie session using Web Crypto, so it works in the proxy and in route handlers. */
export const COOKIE = "gsoc_session";
const MAX_AGE_S = 60 * 60 * 24 * 7;

const enc = new TextEncoder();

function b64u(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64u(s: string): Uint8Array {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function key(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export interface Session {
  analyst: string;
  exp: number;
}

export async function createSession(secret: string, analyst: string): Promise<{ token: string; maxAge: number }> {
  const payload: Session = { analyst: analyst.slice(0, 60), exp: Math.floor(Date.now() / 1000) + MAX_AGE_S };
  const body = b64u(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body));
  return { token: `${body}.${b64u(sig)}`, maxAge: MAX_AGE_S };
}

export async function verifySession(secret: string, token: string | undefined): Promise<Session | null> {
  if (!token || !secret || secret.length < 32) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(secret), fromB64u(sig) as BufferSource, enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64u(body))) as Session;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Constant-time string comparison (compares fixed-length HMAC digests). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const k = await key("compare-key-not-secret-but-fixed-length-digest");
  const [da, db] = await Promise.all([crypto.subtle.sign("HMAC", k, enc.encode(a)), crypto.subtle.sign("HMAC", k, enc.encode(b))]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
