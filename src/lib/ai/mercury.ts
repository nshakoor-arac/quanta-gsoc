import { env } from "../env";

export interface ChatArgs {
  system: string;
  user: string;
  maxTokens: number;
  effort?: string;
  temperature?: number;
  /** JSON schema for structured outputs. Falls back to prompt-only JSON if the API rejects it. */
  schema?: { name: string; schema: Record<string, unknown> };
  signal?: AbortSignal;
}

export interface Usage {
  prompt: number;
  completion: number;
}

export class MercuryError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function friendly(status: number, body: string): string {
  if (status === 401 || status === 403) return "Inception rejected the API key. Check INCEPTION_API_KEY in your environment settings.";
  if (status === 429) return "Inception rate limit reached. Wait a minute and try again.";
  if (status === 402) return "Inception reports a billing or credit problem on this key.";
  if (status >= 500) return "The Inception service returned a server error. Try again shortly.";
  return `Inception request failed (${status}): ${body.slice(0, 200)}`;
}

function buildBody(a: ChatArgs, stream: boolean, level: 0 | 1 | 2) {
  const body: Record<string, unknown> = {
    model: env.inceptionModel,
    messages: [
      { role: "system", content: a.system },
      { role: "user", content: a.user },
    ],
    max_completion_tokens: a.maxTokens,
    stream,
  };
  if (a.temperature !== undefined) body.temperature = a.temperature;
  if (level < 2 && (a.effort ?? env.reasoningEffort)) body.reasoning_effort = a.effort ?? env.reasoningEffort;
  if (level < 1 && a.schema) body.response_format = { type: "json_schema", json_schema: { name: a.schema.name, strict: true, schema: a.schema.schema } };
  if (stream) body.stream_options = { include_usage: true };
  return body;
}

async function post(a: ChatArgs, stream: boolean): Promise<Response> {
  if (!env.inceptionKey) throw new MercuryError("INCEPTION_API_KEY is not set. Add it in your environment settings.", 503);
  let last: MercuryError | null = null;
  // Level 0: everything. Level 1: drop structured outputs. Level 2: drop reasoning_effort too.
  for (const level of [0, 1, 2] as const) {
    if (level === 1 && !a.schema) continue;
    const res = await fetch(`${env.inceptionBase}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.inceptionKey}` },
      body: JSON.stringify(buildBody(a, stream, level)),
      signal: a.signal,
    });
    if (res.ok) return res;
    const text = await res.text().catch(() => "");
    last = new MercuryError(friendly(res.status, text), res.status);
    // Only retry with fewer optional parameters when the API says the request itself was unacceptable.
    if (res.status !== 400 && res.status !== 422) throw last;
  }
  throw last ?? new MercuryError("Inception request failed", 500);
}

export async function complete(a: ChatArgs): Promise<{ text: string; usage: Usage }> {
  const res = await post(a, false);
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  const text = j.choices?.[0]?.message?.content ?? "";
  return { text, usage: { prompt: j.usage?.prompt_tokens ?? Math.ceil((a.system.length + a.user.length) / 4), completion: j.usage?.completion_tokens ?? Math.ceil(text.length / 4) } };
}

export type StreamEvent = { type: "delta"; text: string } | { type: "usage"; usage: Usage };

/** Streams content deltas from an OpenAI-compatible SSE response. */
export async function* stream(a: ChatArgs): AsyncGenerator<StreamEvent> {
  const res = await post(a, true);
  if (!res.body) throw new MercuryError("Inception returned no stream", 502);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let chars = 0;
  let sawUsage = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const j = JSON.parse(data) as { choices?: { delta?: { content?: string | null } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } | null };
        const c = j.choices?.[0]?.delta?.content;
        if (c) {
          chars += c.length;
          yield { type: "delta", text: c };
        }
        if (j.usage && (j.usage.prompt_tokens || j.usage.completion_tokens)) {
          sawUsage = true;
          yield { type: "usage", usage: { prompt: j.usage.prompt_tokens ?? 0, completion: j.usage.completion_tokens ?? 0 } };
        }
      } catch {
        /* ignore malformed keep-alive lines */
      }
    }
  }
  if (!sawUsage) yield { type: "usage", usage: { prompt: Math.ceil((a.system.length + a.user.length) / 4), completion: Math.ceil(chars / 4) } };
}
