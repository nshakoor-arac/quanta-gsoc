/** Small helper that turns an async producer into a Server-Sent Events response. */
export type Send = (event: string, data: unknown) => void;

export function sseResponse(producer: (send: Send, signal: AbortSignal) => Promise<void>, reqSignal: AbortSignal): Response {
  const enc = new TextEncoder();
  const ctrl = new AbortController();
  reqSignal.addEventListener("abort", () => ctrl.abort());
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send: Send = (event, data) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };
      try {
        await producer(send, ctrl.signal);
      } catch (e) {
        send("error", { message: (e as Error).message || "Unexpected error" });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      ctrl.abort();
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
