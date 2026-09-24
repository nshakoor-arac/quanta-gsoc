"use client";
import { useCallback, useEffect, useState } from "react";
import { X, Sparkles, ExternalLink, Pin, PinOff } from "lucide-react";
import type { Article } from "@/lib/types";
import type { Quick } from "@/lib/ai/schemas";
import type { ReferenceRow } from "@/lib/ai/sitrep";
import { postJson } from "@/lib/client/api";
import { BY_ISO2 } from "@/lib/geo/lite";
import { BAND_LABEL } from "@/lib/sources/registry";
import { BandDot, Cited, ThemeChip, typeLabel } from "./ui";
import type { Filters } from "@/lib/client/filters";
import type { WindowKey } from "@/lib/types";

export type DrawerSpec =
  | { kind: "article"; article: Article }
  | { kind: "country"; iso2: string }
  | { kind: "feed"; filters: Filters };

interface QuickOut {
  report: Quick;
  meta: { model: string; confidenceAdjusted: { modelBand: string; appliedBand: string; capped: boolean; reason: string }; metrics: { items: number; independentStreams: number }; references: ReferenceRow[]; baselines: { code: string; label: string; value: number; year: string }[] };
}

interface Props {
  spec: DrawerSpec;
  win: WindowKey;
  onClose: () => void;
  isPinned: (id: string) => boolean;
  togglePin: (a: Article) => void;
  buildReport: (iso2: string) => void;
}

export default function Drawer({ spec, win, onClose, isPinned, togglePin, buildReport }: Props) {
  const [out, setOut] = useState<QuickOut | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [withStats, setWithStats] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    setErr("");
    setOut(null);
    try {
      const body =
        spec.kind === "article"
          ? { kind: "article", window: win, article: spec.article }
          : spec.kind === "country"
            ? { kind: "country", window: win, iso2: spec.iso2 }
            : { kind: "feed", window: win, withStats, filters: { countries: spec.filters.countries, regions: spec.filters.regions, themes: spec.filters.themes, q: spec.filters.q || undefined } };
      setOut(await postJson<QuickOut>("/api/ai/quick", body));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [spec, win, withStats]);

  // Country and feed briefs start automatically. Article analysis starts on click.
  useEffect(() => {
    setOut(null);
    setErr("");
    if (spec.kind !== "article") void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.kind, spec.kind === "country" ? spec.iso2 : "", spec.kind === "article" ? spec.article.id : ""]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const title = spec.kind === "article" ? "Item detail and quick analysis" : spec.kind === "country" ? `Quick brief: ${BY_ISO2[spec.iso2]?.name ?? spec.iso2}` : "Digest of the current feed";

  return (
    <>
      <div className="veil" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={title}>
        <button className="btn ghost sm x-btn" onClick={onClose} aria-label="Close"><X size={14} /></button>
        <div className="eyebrow">{title}</div>

        {spec.kind === "article" && (
          <div style={{ marginTop: 6 }}>
            <h2>{spec.article.title}</h2>
            <div className="meta" style={{ marginTop: 0 }}>
              <BandDot band={spec.article.band} />
              <span>{spec.article.sourceName}</span>
              <span>{typeLabel(spec.article.sourceType)}</span>
              <span>{new Date(spec.article.publishedAt).toUTCString().replace("GMT", "UTC")}</span>
            </div>
            {spec.article.excerpt && <p className="muted" style={{ marginTop: 12 }}>{spec.article.excerpt}</p>}
            <div className="meta" style={{ gap: 5 }}>
              {spec.article.countries.map((c) => <span key={c} className="chip">{BY_ISO2[c]?.name ?? c}</span>)}
              {spec.article.themes.map((t) => <ThemeChip key={t} id={t} />)}
            </div>
            <table className="t" style={{ marginTop: 14 }}>
              <tbody>
                <tr><td className="faint">Source band</td><td>{BAND_LABEL[spec.article.band]}. Provisional automated triage. Analysts confirm or override.</td></tr>
                <tr><td className="faint">Upstream family</td><td className="mono">{spec.article.family}</td></tr>
                <tr><td className="faint">Collected via</td><td className="mono">{spec.article.aggregator}</td></tr>
                <tr><td className="faint">URL</td><td style={{ wordBreak: "break-all" }} className="mono">{spec.article.url}</td></tr>
              </tbody>
            </table>
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <a className="btn gold" href={spec.article.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Open source</a>
              <button className="btn" onClick={() => togglePin(spec.article)}>{isPinned(spec.article.id) ? <><PinOff size={14} /> Unpin</> : <><Pin size={14} /> Pin for SitRep</>}</button>
              {!out && <button className="btn" onClick={run} disabled={busy}><Sparkles size={14} /> {busy ? "Analysing" : "Quick analysis"}</button>}
            </div>
          </div>
        )}

        {spec.kind === "country" && (
          <div style={{ marginTop: 6 }}>
            <h2>{BY_ISO2[spec.iso2]?.name ?? spec.iso2}</h2>
            <button className="btn" onClick={() => buildReport(spec.iso2)}>Build a full QAP SitRep for this country</button>
          </div>
        )}

        {spec.kind === "feed" && (
          <div style={{ marginTop: 6 }}>
            <label className="muted" style={{ display: "flex", gap: 8, alignItems: "center", margin: "10px 0" }}>
              <input type="checkbox" checked={withStats} onChange={(e) => setWithStats(e.target.checked)} /> Include volume statistics in the digest
              <button className="btn sm" onClick={run} disabled={busy}>Re-run</button>
            </label>
          </div>
        )}

        {busy && <div className="note pulse" style={{ marginTop: 16 }}>Mercury is reading the evidence. This usually takes a few seconds.</div>}
        {err && <div className="note bad" style={{ marginTop: 16 }}>{err}</div>}
        {out && <QuickView out={out} />}
      </aside>
    </>
  );
}

function QuickView({ out }: { out: QuickOut }) {
  const r = out.report;
  const m = out.meta;
  return (
    <div style={{ marginTop: 18 }}>
      <div className="sec" style={{ paddingTop: 0 }}>
        <h4>Headline</h4>
        <div className="bluf" style={{ fontSize: 15 }}><Cited text={r.headline} prefix="qref" /></div>
      </div>
      <div className="sec">
        <h4>Key points</h4>
        <ul>{r.points.map((p, i) => <li key={i}><Cited text={p} prefix="qref" /></li>)}</ul>
      </div>
      <div className="sec">
        <h4>5W1H</h4>
        <table className="t"><tbody>
          {(["who", "what", "where", "when", "why", "how"] as const).map((k) => (
            <tr key={k}><td className="mono" style={{ width: 60, textTransform: "uppercase", color: "var(--gold)" }}>{k}</td><td><Cited text={r.five_w[k]} prefix="qref" /></td></tr>
          ))}
        </tbody></table>
      </div>
      <div className="sec">
        <h4>So what</h4>
        <p><Cited text={r.so_what} prefix="qref" /></p>
      </div>
      {r.watch.length > 0 && (
        <div className="sec"><h4>Watch</h4><ul>{r.watch.map((w, i) => <li key={i}><Cited text={w} prefix="qref" /></li>)}</ul></div>
      )}
      <div className="sec">
        <h4>Confidence and limits</h4>
        <p><span className={`badge ${m.confidenceAdjusted.appliedBand === "high" ? "low" : m.confidenceAdjusted.appliedBand === "moderate" ? "moderate" : "elevated"}`}>{m.confidenceAdjusted.appliedBand} confidence</span>{" "}
          <span className="faint">{m.metrics.items} direct item{m.metrics.items === 1 ? "" : "s"}, {m.metrics.independentStreams} independent direct stream{m.metrics.independentStreams === 1 ? "" : "s"}</span></p>
        {m.confidenceAdjusted.capped && <p className="faint">The model proposed {m.confidenceAdjusted.modelBand}. It was capped: {m.confidenceAdjusted.reason}</p>}
        <ul>{r.caveats.map((c, i) => <li key={i}>{c}</li>)}</ul>
        <p className="faint" style={{ fontSize: 12 }}>Quick analysis is based on headlines and short excerpts only. Treat it as triage, not as a finished assessment.</p>
      </div>
      <div className="sec">
        <h4>References</h4>
        {m.baselines?.length > 0 && <div className="faint" style={{ marginBottom: 8, fontSize: 12 }}>{m.baselines.map((b) => `[${b.code}] ${b.label} ${b.value} (${b.year})`).join("; ")}</div>}
        <ol style={{ listStyle: "none", padding: 0 }}>
          {m.references.map((x) => (
            <li key={x.n} id={`qref-${x.n}`} style={{ marginBottom: 8 }}>
              <span className="mono gold" style={{ color: "var(--gold)" }}>[{x.n}]</span>{" "}
              {x.role && <span className={`chip ${x.role === "direct" ? "gold" : ""}`} style={{ marginRight: 6 }}>{x.role.toUpperCase()}</span>}
              <a href={x.url} target="_blank" rel="noopener noreferrer">{x.title}</a>
              <div className="faint" style={{ fontSize: 11.5 }}>{x.source} | {typeLabel(x.type)} | {x.band} | {new Date(x.publishedAt).toISOString().slice(0, 10)}</div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
