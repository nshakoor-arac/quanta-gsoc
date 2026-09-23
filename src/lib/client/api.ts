export async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error || `Request failed (${r.status})`);
  return j as T;
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401) window.location.href = "/login";
    throw new Error((j as { error?: string }).error || `Request failed (${r.status})`);
  }
  return j as T;
}

export type SseHandler = (event: string, data: any) => void;

/** POSTs JSON and reads a Server-Sent Events response. Resolves when the stream ends. */
export async function postSse(url: string, body: unknown, on: SseHandler, signal?: AbortSignal): Promise<void> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (!r.ok || !r.body) {
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) window.location.href = "/login";
    throw new Error((j as { error?: string }).error || `Request failed (${r.status})`);
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      let ev = "message";
      let data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) ev = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (data) {
        try {
          on(ev, JSON.parse(data));
        } catch {
          /* ignore malformed frame */
        }
      }
    }
  }
}
