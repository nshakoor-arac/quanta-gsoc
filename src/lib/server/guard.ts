import { env } from "../env";
import { getStore } from "../store";

export async function aiBudget(): Promise<{ ok: boolean; used: number; limit: number }> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const used = await getStore().countAi(since).catch(() => 0);
  return { ok: used < env.aiDailyLimit, used, limit: env.aiDailyLimit };
}
