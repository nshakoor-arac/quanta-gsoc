import { env } from "../env";
import { memoryStore } from "./memory";
import { supabaseStore } from "./supabase";
import type { Store } from "./types";

let cached: Store | null = null;
let cachedSig = "";

/** Returns Supabase when configured, otherwise an in-memory store (data is lost on restart). */
export function getStore(): Store {
  const sig = `${env.supabaseUrl}|${env.supabaseKey.slice(0, 8)}`;
  if (cached && cachedSig === sig) return cached;
  cachedSig = sig;
  cached = env.supabaseUrl && env.supabaseKey ? supabaseStore(env.supabaseUrl, env.supabaseKey) : memoryStore();
  return cached;
}
export type { Store } from "./types";
