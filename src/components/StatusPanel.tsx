"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, X, RefreshCw } from "lucide-react";
import { getJson, postJson } from "@/lib/client/api";
import { timeAgo } from "@/lib/analytics";
import { Card, typeLabel } from "./ui";

interface Status {
  analyst: string;
  config: Record<string, boolean | string>;
  store: string;
  articles: number;
  lastFetch: string | null;
  ai: { model: string; effort: string; used: number; limit: number };
  feeds: { id: string; name: string; type: string; band: string; ok: boolean | null; count: number | null; error: string | null }[];
  sources: { source: string; ok: boolean; count: number; at: string; error?: string }[];
}

export default function StatusPanel({ onRefreshed }: { onRefreshed: () => void }) {
  const [s, setS] = useState<Status | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    try { setS(await getJson<Status>("/api/status")); } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function job(name: string, body: unknown) {
    setBusy(name);
    try { await postJson("/api/ingest", body); await load(); onRefreshed(); } catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  }

  if (!s) return <div className="empty pulse">{err || "Loading status"}</div>;
  const check = (ok: boolean) => ok ? <Check size={14} color="var(--green)" /> : <X size={14} color="var(--red)" />;
  const cfg = s.config as Record<string, boolean>;
  return (
    <div className="grid" style={{ gap: 14 }}>
      {err && <div className="note bad">{err}</div>}
      <div className="grid g3">
        <Card title="Configuration">
          <table className="t"><tbody>
            <tr><td>{check(!!cfg.ai)}</td><td>Mercury AI key</td><td className="faint">{s.ai.model}</td></tr>
            <tr><td>{check(s.store === "supabase")}</td><td>Database</td><td className="faint">{s.store === "supabase" ? "Supabase (persistent)" : "Memory only, data resets on restart"}</td></tr>
            <tr><td>{check(!!cfg.accessCode && !!cfg.sessionSecret)}</td><td>Access code</td><td className="faint">{cfg.accessCode && cfg.sessionSecret ? "set" : "not set"}</td></tr>
            <tr><td>{check(!!cfg.reliefweb)}</td><td>ReliefWeb app name</td><td className="faint">{cfg.reliefweb ? "set" : "optional, not set"}</td></tr>
            <tr><td>{check(!!cfg.cron)}</td><td>Scheduled refresh secret</td><td className="faint">{cfg.cron ? "set" : "optional, not set"}</td></tr>
          </tbody></table>
        </Card>
        <Card title="AI usage (last 24 hours)">
          <div className="kpi" style={{ padding: "0 0 0 12px" }}><div className="v">{s.ai.used} <span className="faint" style={{ fontSize: 16 }}>of {s.ai.limit}</span></div><div className="l">calls used</div></div>
          <p className="faint" style={{ fontSize: 12 }}>The daily limit protects your API budget. Change AI_DAILY_LIMIT to adjust it. Reasoning effort default: {s.ai.effort}.</p>
        </Card>
        <Card title="Collection">
          <p style={{ marginTop: 0 }}><b>{s.articles.toLocaleString()}</b> items stored. Last collected {s.lastFetch ? timeAgo(s.lastFetch) : "never"}.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn sm" disabled={!!busy} onClick={() => job("rss", { job: "rss" })}><RefreshCw size={12} className={busy === "rss" ? "spin" : ""} /> Refresh RSS feeds</button>
            <button className="btn sm" disabled={!!busy} onClick={() => job("rw", { job: "reliefweb" })}><RefreshCw size={12} className={busy === "rw" ? "spin" : ""} /> ReliefWeb</button>
            <button className="btn sm" disabled={!!busy} onClick={() => job("gd", { job: "gdelt-theme", theme: "conflict", timespan: "72h" })}><RefreshCw size={12} className={busy === "gd" ? "spin" : ""} /> GDELT conflict</button>
          </div>
        </Card>
      </div>
      <Card title="Feed health (latest RSS run)">
        <div className="scroll-x"><table className="t"><thead><tr><th></th><th>Feed</th><th>Type</th><th>Band</th><th>Items</th><th>Note</th></tr></thead>
          <tbody>{s.feeds.map((f) => (
            <tr key={f.id}><td>{f.ok === null ? <span className="dot" /> : check(f.ok)}</td><td>{f.name}</td><td className="faint">{typeLabel(f.type)}</td><td><span className={`dot ${f.band === "unrated" ? "" : f.band}`} /> {f.band}</td><td className="mono">{f.count ?? ""}</td><td className="faint">{f.error ?? ""}</td></tr>
          ))}</tbody></table></div>
      </Card>
      {s.sources.length > 0 && (
        <Card title="Recent collection runs">
          <table className="t"><thead><tr><th></th><th>Job</th><th>Items</th><th>When</th><th>Note</th></tr></thead>
            <tbody>{s.sources.map((r, i) => <tr key={i}><td>{check(r.ok)}</td><td className="mono">{r.source}</td><td className="mono">{r.count}</td><td className="faint">{timeAgo(r.at)}</td><td className="faint">{r.error ?? ""}</td></tr>)}</tbody></table>
        </Card>
      )}
    </div>
  );
}
