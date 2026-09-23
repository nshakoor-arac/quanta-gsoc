export const UA = "Mozilla/5.0 (compatible; QuantaGSOC/1.0; +https://quanta-analytica.com)";

export async function fetchText(url: string, opts: { timeoutMs?: number; headers?: Record<string, string> } = {}): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 12000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, application/json, text/xml, */*", ...(opts.headers ?? {}) },
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchJson<T = unknown>(url: string, opts: { timeoutMs?: number; headers?: Record<string, string>; method?: string; body?: unknown } = {}): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15000);
  try {
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/json", ...(opts.body ? { "Content-Type": "application/json" } : {}), ...(opts.headers ?? {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Non-JSON response: ${text.slice(0, 120)}`);
    }
  } finally {
    clearTimeout(t);
  }
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Runs async tasks with a concurrency ceiling, preserving result order. */
export async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}
