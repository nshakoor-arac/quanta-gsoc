"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Plus, Trash2, Pin } from "lucide-react";
import type { ScopeTarget, WindowKey } from "@/lib/types";
import { COUNTRIES, REGIONS } from "@/lib/geo/lite";
import { THEMES } from "@/lib/taxonomy";
import { getJson, postSse } from "@/lib/client/api";
import type { Ctx } from "./ctx";
import SitrepView, { type ReportView } from "./SitrepView";
import { Card, Seg } from "./ui";

type Mode = "sitrep" | "compare";
type TType = "country" | "region" | "theme" | "global";
interface Row { type: TType; id: string; withinType?: "" | "country" | "region"; withinId?: string }

interface Summary { id: string; createdAt: string; analyst: string; kind: "sitrep" | "compare"; title: string; keyJudgment?: string; threat?: string }

const WINS: { v: WindowKey; l: string }[] = [{ v: "24h", l: "24h" }, { v: "72h", l: "72h" }, { v: "7d", l: "7d" }, { v: "30d", l: "30d" }];

function toTarget(r: Row): ScopeTarget {
  const t: ScopeTarget = { type: r.type, id: r.type === "global" ? "global" : r.id };
  if (r.type === "theme" && r.withinType && r.withinId) t.within = { type: r.withinType, id: r.withinId };
  return t;
}
const valid = (r: Row) => r.type === "global" || !!r.id;

function TargetPicker({ row, onChange, allowGlobal, lockType }: { row: Row; onChange: (r: Row) => void; allowGlobal: boolean; lockType?: TType }) {
  const type = lockType ?? row.type;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {!lockType && (
        <select className="select" value={row.type} onChange={(e) => onChange({ type: e.target.value as TType, id: "" })}>
          <option value="country">Country</option>
          <option value="region">Region</option>
          <option value="theme">Theme</option>
          {allowGlobal && <option value="global">Global</option>}
        </select>
      )}
      {type === "country" && (
        <select className="select" value={row.id} onChange={(e) => onChange({ ...row, id: e.target.value })}>
          <option value="">Choose a country</option>
          {COUNTRIES.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.iso2} value={c.iso2}>{c.name}</option>)}
        </select>
      )}
      {type === "region" && (
        <select className="select" value={row.id} onChange={(e) => onChange({ ...row, id: e.target.value })}>
          <option value="">Choose a region</option>
          {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      )}
      {type === "theme" && (
        <>
          <select className="select" value={row.id} onChange={(e) => onChange({ ...row, id: e.target.value })}>
            <option value="">Choose a theme</option>
            {THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <select className="select" value={row.withinType ?? ""} onChange={(e) => onChange({ ...row, withinType: e.target.value as Row["withinType"], withinId: "" })} title="Optional narrowing">
            <option value="">Worldwide</option>
            <option value="country">within a country</option>
            <option value="region">within a region</option>
          </select>
          {row.withinType === "country" && (
            <select className="select" value={row.withinId ?? ""} onChange={(e) => onChange({ ...row, withinId: e.target.value })}>
              <option value="">Country</option>
              {COUNTRIES.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.iso2} value={c.iso2}>{c.name}</option>)}
            </select>
          )}
          {row.withinType === "region" && (
            <select className="select" value={row.withinId ?? ""} onChange={(e) => onChange({ ...row, withinId: e.target.value })}>
              <option value="">Region</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
        </>
      )}
      {type === "global" && <span className="muted">All regions and themes in the collected stream</span>}
    </div>
  );
}

export default function Reports({ ctx, seed, clearSeed }: { ctx: Ctx; seed: ScopeTarget | null; clearSeed: () => void }) {
  const [mode, setMode] = useState<Mode>("sitrep");
  const [win, setWin] = useState<WindowKey>("72h");
  const [effort, setEffort] = useState<"low" | "medium" | "high">("medium");
  const [row, setRow] = useState<Row>({ type: "country", id: "" });
  const [cmp, setCmp] = useState<Row[]>([{ type: "country", id: "" }, { type: "country", id: "" }]);
  const [usePinned, setUsePinned] = useState(true);
  const [stage, setStage] = useState("");
  const [prep, setPrep] = useState<{ label: string; evidence: number; streams: number; ceiling: { band: string }; toppedUp: string[] } | null>(null);
  const [tail, setTail] = useState("");
  const [chars, setChars] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [view, setView] = useState<ReportView | null>(null);
  const [hist, setHist] = useState<Summary[]>([]);
  const abort = useRef<AbortController | null>(null);

  const loadHist = useCallback(async () => {
    try { setHist((await getJson<{ reports: Summary[] }>("/api/reports")).reports); } catch { /* history is optional */ }
  }, []);
  useEffect(() => { void loadHist(); }, [loadHist]);

  useEffect(() => {
    if (!seed) return;
    setMode("sitrep");
    setRow({ type: seed.type as TType, id: seed.id === "global" ? "" : seed.id, withinType: seed.within?.type, withinId: seed.within?.id });
    clearSeed();
  }, [seed, clearSeed]);

  const compareType = cmp[0].type;
  const canRun = mode === "sitrep" ? valid(row) && (row.type !== "theme" || !row.withinType || !!row.withinId) : cmp.every(valid) && new Set(cmp.map((c) => `${c.type}:${c.id}:${c.withinId ?? ""}`)).size === cmp.length;

  async function run() {
    setBusy(true); setErr(""); setView(null); setPrep(null); setTail(""); setChars(0); setStage("Starting");
    const ctl = new AbortController();
    abort.current = ctl;
    const pinned = usePinned ? ctx.pinned.map((a) => ({ article: a })) : [];
    const body = mode === "sitrep" ? { scope: toTarget(row), window: win, pinned, effort } : { targets: cmp.map(toTarget), window: win, pinned, effort };
    let got = false;
    try {
      await postSse(mode === "sitrep" ? "/api/ai/sitrep" : "/api/ai/compare", body, (ev, d) => {
        if (ev === "stage") setStage(d.message);
        else if (ev === "prepared") setPrep(d);
        else if (ev === "delta") { setChars((n) => n + d.text.length); setTail((t) => (t + d.text).slice(-600)); }
        else if (ev === "error") setErr(d.message);
        else if (ev === "done") { got = true; setView({ id: d.id, kind: mode, report: d.report, meta: d.meta, analyst: d.analyst, createdAt: d.createdAt }); void loadHist(); }
      }, ctl.signal);
      if (!got && !err) setErr((e) => e || "The stream ended before a report was returned. Try again.");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setErr((e as Error).message);
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  async function openSaved(id: string) {
    setErr(""); setBusy(true);
    try {
      const r = await getJson<{ id: string; kind: "sitrep" | "compare"; report: ReportView["report"]; meta: ReportView["meta"]; analyst: string; createdAt: string }>(`/api/reports/${id}`);
      setView({ id: r.id, kind: r.kind, report: r.report, meta: r.meta, analyst: r.analyst, createdAt: r.createdAt });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function del(id: string) {
    if (!confirm("Delete this saved report?")) return;
    await fetch(`/api/reports/${id}`, { method: "DELETE" });
    void loadHist();
    if (view?.id === id) setView(null);
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="split">
        <Card title="Report generator">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
            <Seg value={mode} onChange={setMode} options={[{ v: "sitrep", l: "Single SitRep" }, { v: "compare", l: "Compare 2 to 4" }]} />
            <Seg value={win} onChange={setWin} options={WINS} />
            <select className="select" value={effort} onChange={(e) => setEffort(e.target.value as typeof effort)} title="How much reasoning the model spends">
              <option value="low">Reasoning: fast</option>
              <option value="medium">Reasoning: balanced</option>
              <option value="high">Reasoning: deep</option>
            </select>
          </div>

          {mode === "sitrep" ? (
            <TargetPicker row={row} onChange={setRow} allowGlobal />
          ) : (
            <div className="grid" style={{ gap: 8 }}>
              {cmp.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="mono faint" style={{ width: 22 }}>{String.fromCharCode(65 + i)}</span>
                  {i === 0 ? <TargetPicker row={r} onChange={(x) => setCmp((p) => p.map((y, j) => (j === 0 ? x : y.type === x.type ? y : { type: x.type, id: "" })))} allowGlobal={false} /> : <TargetPicker row={r} onChange={(x) => setCmp((p) => p.map((y, j) => (j === i ? x : y)))} allowGlobal={false} lockType={compareType} />}
                  {i >= 2 && <button className="btn sm ghost" onClick={() => setCmp((p) => p.filter((_, j) => j !== i))}><Trash2 size={12} /></button>}
                </div>
              ))}
              {cmp.length < 4 && <div><button className="btn sm" onClick={() => setCmp((p) => [...p, { type: compareType, id: "" }])}><Plus size={12} /> Add target</button></div>}
              <div className="faint" style={{ fontSize: 12 }}>Compare countries with countries, regions with regions, or themes with themes. Confidence in the comparison is capped by the thinnest target.</div>
            </div>
          )}

          <label className="muted" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14 }}>
            <input type="checkbox" checked={usePinned} onChange={(e) => setUsePinned(e.target.checked)} />
            <Pin size={13} /> Include {ctx.pinned.length} pinned item{ctx.pinned.length === 1 ? "" : "s"} as priority evidence
          </label>

          <div style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn gold" onClick={run} disabled={busy || !canRun}>{busy ? <><Loader2 size={14} className="spin" /> Working</> : "Generate report"}</button>
            {busy && <button className="btn ghost" onClick={() => abort.current?.abort()}>Cancel</button>}
            {!canRun && !busy && <span className="faint">Choose a target to continue.</span>}
          </div>
        </Card>

        <Card title="Saved reports" right={<button className="btn sm ghost" onClick={loadHist}>Refresh</button>}>
          {hist.length === 0 ? <div className="empty">No saved reports yet. Every generated report is saved here automatically.</div> : (
            <div className="feed" style={{ maxHeight: 340, overflowY: "auto" }}>
              {hist.map((h) => (
                <div key={h.id} className="row" style={{ gridTemplateColumns: "1fr auto" }}>
                  <div>
                    <div className="t" onClick={() => openSaved(h.id)}>{h.title}</div>
                    <div className="meta"><span className="chip">{h.kind === "sitrep" ? "SitRep" : "Compare"}</span>{h.threat && <span className={`badge ${h.threat}`} style={{ fontSize: 9.5 }}>{h.threat}</span>}<span>{new Date(h.createdAt).toISOString().slice(0, 16).replace("T", " ")} UTC</span><span>{h.analyst}</span></div>
                  </div>
                  <button className="btn sm ghost" onClick={() => del(h.id)} aria-label="Delete"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {busy && (
        <div className="card">
          <div className="eyebrow pulse">{stage || "Working"}</div>
          {prep && (
            <p className="muted" style={{ margin: "8px 0" }}>
              {prep.label}: {prep.evidence} evidence items from {prep.streams} independent stream(s). Confidence ceiling: {prep.ceiling.band}.{prep.toppedUp.length > 0 && ` Live top-up from ${prep.toppedUp.join(", ")}.`}
            </p>
          )}
          {chars > 0 && <><div className="faint mono" style={{ fontSize: 11, marginBottom: 6 }}>{chars.toLocaleString()} characters drafted</div><div className="stream">{tail}</div></>}
        </div>
      )}
      {err && <div className="note bad">{err}</div>}
      {view && <SitrepView v={view} />}
    </div>
  );
}
