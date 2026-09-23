// End-to-end check of a running console. Usage: npm run smoke  (app on :3000)  or  BASE=https://your-app.vercel.app CODE=... npm run smoke
const BASE = process.env.BASE || "http://localhost:3000";
const CODE = process.env.CODE || "";
let cookie = "";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { (cond ? pass++ : fail++); console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); };

async function req(path, opts = {}) {
  const r = await fetch(BASE + path, { ...opts, headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}), ...(opts.headers || {}) }, redirect: "manual" });
  const sc = r.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  return r;
}
async function sse(path, body) {
  const r = await req(path, { method: "POST", body: JSON.stringify(body) });
  if (!r.ok) return { status: r.status, events: [], error: (await r.json().catch(() => ({}))).error };
  const text = await r.text();
  const events = text.split("\n\n").filter(Boolean).map((b) => { const ev = /event: (.+)/.exec(b)?.[1]; const d = /data: (.+)/.exec(b)?.[1]; return { ev, data: d ? JSON.parse(d) : null }; });
  return { status: r.status, events };
}

const h = await req("/api/health");
ok("health endpoint", h.status === 200);

if (CODE) {
  const bad = await req("/api/auth/login", { method: "POST", body: JSON.stringify({ code: "wrong-code-123" }) });
  ok("wrong code rejected", bad.status === 401);
  const good = await req("/api/auth/login", { method: "POST", body: JSON.stringify({ code: CODE, name: "Smoke" }) });
  ok("correct code accepted", good.status === 200 && !!cookie);
}
const anon = await fetch(BASE + "/api/status", { redirect: "manual" });
if (CODE) ok("protected route blocks anonymous", anon.status === 401);

const st = await (await req("/api/status")).json();
ok("status reports config", !!st.config, `store=${st.store} ai=${st.config?.ai}`);

console.log("Collecting feeds (can take 30 to 60 seconds)...");
const a = await (await req("/api/articles?window=7d")).json();
ok("articles returned", Array.isArray(a.items) && a.items.length > 50, `${a.items?.length ?? 0} items`);
const withC = a.items?.filter((x) => x.countries.length).length ?? 0;
ok("country tagging works", withC > 20, `${withC} tagged`);
const dash = a.items?.filter((x) => /[\u2013\u2014]/.test(x.title + x.excerpt)).length ?? 0;
console.log(`INFO  ${dash} source items contain dash characters (source text is stored as published)`);

const bl = await (await req("/api/baselines?iso2=SD,UA")).json();
if (bl.unavailable) console.log("WARN  world bank baselines unavailable right now (network); SitReps will run without them"); else ok("world bank baselines", !!bl.rows?.SD, "SD and UA rows");

if (st.config?.ai) {
  const country = a.items.flatMap((x) => x.countries).reduce((m, c) => (m[c] = (m[c] || 0) + 1, m), {});
  const top = Object.entries(country).sort((x, y) => y[1] - x[1]).slice(0, 2).map((x) => x[0]);
  const s = await sse("/api/ai/sitrep", { scope: { type: "country", id: top[0] }, window: "7d", pinned: [] });
  const done = s.events.find((e) => e.ev === "done");
  ok("sitrep generated", !!done, s.error || s.events.find((e) => e.ev === "error")?.data?.message || "");
  if (done) {
    const r = done.data.report;
    const all = JSON.stringify(r);
    ok("sitrep has no em or en dashes", !/[\u2013\u2014]/.test(all));
    ok("sitrep has reference register", done.data.meta.references.length >= 3, `${done.data.meta.references.length} refs`);
    ok("invalid citations removed", !/\[(\d{3,})\]/.test(all));
    const saved = await (await req(`/api/reports/${done.data.id}`)).json();
    ok("report saved and retrievable", saved.id === done.data.id);
  }
  const c = await sse("/api/ai/compare", { targets: top.map((id) => ({ type: "country", id })), window: "7d", pinned: [] });
  ok("comparison generated", !!c.events.find((e) => e.ev === "done"), c.error || c.events.find((e) => e.ev === "error")?.data?.message || "");
  const art = a.items.find((x) => x.countries.length);
  const q = await req("/api/ai/quick", { method: "POST", body: JSON.stringify({ kind: "article", window: "7d", article: art }) });
  ok("quick analysis works", q.status === 200, `status ${q.status}`);
  const bad = await req("/api/ai/sitrep", { method: "POST", body: JSON.stringify({ scope: { type: "country", id: "ZZ" }, window: "7d" }) });
  ok("invalid scope rejected", bad.status === 400);
} else {
  console.log("SKIP  AI tests (no INCEPTION_API_KEY on the server)");
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
