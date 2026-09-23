/** Central, typed access to environment variables. Never import this in client components. */
function num(v: string | undefined, d: number): number {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : d;
}

export const env = {
  get accessCode() {
    return process.env.APP_ACCESS_CODE ?? "";
  },
  get sessionSecret() {
    return process.env.SESSION_SECRET ?? "";
  },
  get inceptionKey() {
    return process.env.INCEPTION_API_KEY ?? "";
  },
  get inceptionBase() {
    return (process.env.INCEPTION_BASE_URL || "https://api.inceptionlabs.ai/v1").replace(/\/+$/, "");
  },
  get inceptionModel() {
    return process.env.INCEPTION_MODEL || "mercury-2.5";
  },
  get reasoningEffort() {
    const v = (process.env.MERCURY_REASONING_EFFORT || "medium").toLowerCase();
    return ["none", "minimal", "low", "medium", "high"].includes(v) ? v : "medium";
  },
  get aiDailyLimit() {
    return num(process.env.AI_DAILY_LIMIT, 80);
  },
  get supabaseUrl() {
    return process.env.SUPABASE_URL ?? "";
  },
  get supabaseKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  },
  get reliefwebAppname() {
    return process.env.RELIEFWEB_APPNAME ?? "";
  },
  get gdeltLang() {
    return process.env.GDELT_SOURCE_LANG || "english";
  },
  get gdeltBase() {
    return (process.env.GDELT_BASE_URL || "https://api.gdeltproject.org/api/v2/doc/doc").replace(/\/+$/, "");
  },
  get cronSecret() {
    return process.env.CRON_SECRET ?? "";
  },
  get isProd() {
    return process.env.NODE_ENV === "production";
  },
};

export function configStatus() {
  return {
    accessCode: Boolean(env.accessCode),
    sessionSecret: env.sessionSecret.length >= 32,
    ai: Boolean(env.inceptionKey),
    database: Boolean(env.supabaseUrl && env.supabaseKey),
    reliefweb: Boolean(env.reliefwebAppname),
    cron: Boolean(env.cronSecret),
  };
}
