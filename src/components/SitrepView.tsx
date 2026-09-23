"use client";
import { Copy, Download, Printer } from "lucide-react";
import type { Compare, Sitrep } from "@/lib/ai/schemas";
import type { FinalMeta } from "@/lib/ai/sitrep";
import { BRAND } from "@/lib/brand";
import { reportToMarkdown } from "@/lib/client/reportMd";
import { Badge, Cited, typeLabel } from "./ui";

export interface ReportView {
  id: string;
  kind: "sitrep" | "compare";
  report: Sitrep | Compare;
  meta: FinalMeta;
  analyst: string;
  createdAt: string;
}

const heat = (n: number) => `rgba(${n >= 4 ? "217,83,79" : n === 3 ? "224,160,58" : "79,174,123"},${0.25 + n * 0.1})`;
const ratingLevel = (r: string) => (r === "high" ? "high" : r === "elevated" ? "elevated" : r === "moderate" ? "moderate" : r === "low" ? "low" : "unclear");

function Sec({ t, children }: { t: string; children: React.ReactNode }) {
  return <section className="sec"><h4>{t}</h4>{children}</section>;
}
const Ul = ({ a }: { a: string[] }) => <ul>{a.map((x, i) => <li key={i}><Cited text={x} /></li>)}</ul>;

export default function SitrepView({ v }: { v: ReportView }) {
  const r = v.report;
  const m = v.meta;
  const s = v.kind === "sitrep" ? (r as Sitrep) : null;
  const c = v.kind === "compare" ? (r as Compare) : null;

  function download(name: string, text: string, type: string) {
    const b = new Blob([text], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  const md = () => reportToMarkdown(v.kind, r, m, v.analyst, v.createdAt);

  return (
    <article className="report" id="report-root">
      <header className="rep-head">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span className="eyebrow">{v.kind === "sitrep" ? "QAP Situation Report" : "QAP Comparative Assessment"}</span>
          <span className="mono faint" style={{ fontSize: 11 }}>{m.id}</span>
        </div>
        <h1>{r.title}</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Badge level={r.threat_level} />
          <span className={`badge ${m.confidenceAdjusted.appliedBand === "high" ? "low" : m.confidenceAdjusted.appliedBand === "moderate" ? "moderate" : "elevated"}`}>{m.confidenceAdjusted.appliedBand} confidence</span>
          <span className="faint mono" style={{ fontSize: 11 }}>Window {m.window} | {m.metrics.items} items | {m.metrics.independentStreams} independent streams | {new Date(v.createdAt).toUTCString().replace("GMT", "UTC")} | {v.analyst}</span>
        </div>
        <div className="no-print" style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <button className="btn sm" onClick={() => window.print()}><Printer size={12} /> Print or save PDF</button>
          <button className="btn sm" onClick={() => navigator.clipboard.writeText(md())}><Copy size={12} /> Copy Markdown</button>
          <button className="btn sm" onClick={() => download(`${m.id}.md`, md(), "text/markdown")}><Download size={12} /> Markdown</button>
          <button className="btn sm" onClick={() => download(`${m.id}.json`, JSON.stringify({ report: r, meta: m }, null, 2), "application/json")}><Download size={12} /> JSON</button>
        </div>
      </header>

      <div className="rep-body">
        <Sec t="Bottom line up front"><div className="bluf"><Cited text={r.key_judgment} /></div></Sec>

        {s && (
          <>
            <Sec t="Situation snapshot">
              <div className="snap">{s.snapshot.map((x, i) => <div key={i}><div className="f">{x.figure}</div><div className="l">{x.label}</div></div>)}</div>
              <p style={{ marginTop: 12 }}><b>Threat rationale.</b> <Cited text={s.threat_rationale} /></p>
            </Sec>
            <Sec t="Situation overview"><p><Cited text={s.situation_overview} /></p></Sec>
            <Sec t="Key developments"><Ul a={s.key_developments} /></Sec>
            <Sec t="Assessment"><p><Cited text={s.assessment} /></p></Sec>
            <Sec t="Strategic implications"><p><Cited text={s.strategic_implications} /></p></Sec>
            <Sec t="Priority intelligence points"><Ul a={s.priority_points} /></Sec>
            <Sec t="Actor dynamics"><Ul a={s.actor_dynamics} /></Sec>
            <Sec t="Risk register (ISO 31000 style)">
              <div className="scroll-x"><table className="t"><thead><tr><th>Risk</th><th>Likelihood</th><th>Impact</th><th>Mitigant</th></tr></thead>
                <tbody>{s.risks.map((x, i) => <tr key={i}><td><Cited text={x.risk} /></td><td><span className="heat" style={{ background: heat(x.likelihood) }}>{x.likelihood}</span></td><td><span className="heat" style={{ background: heat(x.impact) }}>{x.impact}</span></td><td><Cited text={x.mitigant} /></td></tr>)}</tbody></table></div>
              <p className="faint" style={{ fontSize: 12, marginBottom: 0 }}>Scores run 1 (lowest) to 5 (highest). They are analyst-style judgments from the evidence in the register, not measured frequencies.</p>
            </Sec>
            <Sec t="Near-term outlook">
              <div className="grid g3">{s.near_term_outlook.map((o, i) => <div className="card" key={i}><div className="eyebrow">{o.scenario} | {o.probability_band}</div><p style={{ margin: "8px 0" }}><Cited text={o.description} /></p><div className="faint" style={{ fontSize: 12 }}>Trigger: <Cited text={o.trigger} /></div></div>)}</div>
            </Sec>
          </>
        )}

        {c && (
          <>
            <Sec t="Targets compared">
              <div className="grid g3">{c.targets.map((t, i) => <div className="card" key={i}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b>{t.name}</b><Badge level={t.threat_level} /></div><p style={{ margin: "8px 0 0" }}><Cited text={t.rationale} /></p></div>)}</div>
            </Sec>
            <Sec t="Comparison matrix">
              <div className="scroll-x"><table className="t"><thead><tr><th>Dimension</th>{c.targets.map((t) => <th key={t.name}>{t.name}</th>)}</tr></thead>
                <tbody>{c.matrix.map((row, i) => <tr key={i}><td><b>{row.dimension}</b></td>{c.targets.map((t) => { const cell = row.cells.find((x) => x.target === t.name); return <td key={t.name}>{cell ? <><Badge level={ratingLevel(cell.rating)} /><div style={{ marginTop: 4, fontSize: 12 }}><Cited text={cell.note} /></div></> : <span className="faint">n/a</span>}</td>; })}</tr>)}</tbody></table></div>
            </Sec>
            <Sec t="Ranking"><ol>{c.ranking.slice().sort((a, b) => a.rank - b.rank).map((x, i) => <li key={i}><b>{x.target}.</b> <Cited text={x.rationale} /></li>)}</ol></Sec>
            <Sec t="Convergences"><Ul a={c.convergences} /></Sec>
            <Sec t="Divergences"><Ul a={c.divergences} /></Sec>
            <Sec t="Implications"><p><Cited text={c.implications} /></p></Sec>
          </>
        )}

        <Sec t="Action items">
          <div className="scroll-x"><table className="t"><tbody>{r.action_items.map((a, i) => <tr key={i}><td className="mono" style={{ width: 90, color: "var(--gold)" }}>{a.horizon}</td><td><Cited text={a.action} /></td></tr>)}</tbody></table></div>
        </Sec>

        <Sec t="Know, assess, unknown">
          <div className="kwu">
            <div><h5>Know (sourced fact)</h5><Ul a={r.know} /></div>
            <div><h5>Assess (judgment)</h5><Ul a={r.assess} /></div>
            <div><h5>Unknown</h5><Ul a={r.unknown} /></div>
          </div>
        </Sec>

        {s && (
          <Sec t="Assumptions">
            <div className="scroll-x"><table className="t"><thead><tr><th>ID</th><th>Assumption</th><th>Why it matters</th><th>Risk if wrong</th></tr></thead>
              <tbody>{s.assumptions.map((a, i) => <tr key={i}><td className="mono">{a.id}</td><td>{a.assumption}</td><td>{a.why_it_matters}</td><td>{a.risk_if_wrong}</td></tr>)}</tbody></table></div>
          </Sec>
        )}

        <Sec t="Early warning indicators">
          <div className="scroll-x"><table className="t"><thead><tr><th>Indicator</th><th>Direction</th><th>Threshold</th><th>Cadence</th></tr></thead>
            <tbody>{r.indicators.map((x, i) => <tr key={i}><td>{x.indicator}</td><td className="mono">{x.direction}</td><td>{x.threshold}</td><td>{x.cadence}</td></tr>)}</tbody></table></div>
        </Sec>

        <Sec t="Collection gaps"><Ul a={r.collection_gaps} /></Sec>

        <Sec t="Confidence and evidence quality">
          <p><span className={`badge ${m.confidenceAdjusted.appliedBand === "high" ? "low" : m.confidenceAdjusted.appliedBand === "moderate" ? "moderate" : "elevated"}`}>{m.confidenceAdjusted.appliedBand}</span> <span className="muted">{m.confidenceAdjusted.reason}</span></p>
          {m.confidenceAdjusted.capped && <div className="note warn" style={{ marginBottom: 10 }}>The model proposed {m.confidenceAdjusted.modelBand} confidence. The console lowered it to {m.confidenceAdjusted.appliedBand} because the evidence base did not support more.</div>}
          <div className="grid g2">
            <div><b>Reasons</b><Ul a={r.confidence.reasons} /></div>
            <div><b>What would change this</b><Ul a={r.confidence.flip_risks} /></div>
          </div>
          <p className="faint" style={{ fontSize: 12 }}>Citation audit: {m.citation.cited} of {m.citation.statements} analytic statements carry a citation. {m.citation.invalidRemoved} invalid citation marker(s) were removed automatically.{m.citation.uncited.length > 0 && <> Uncited statements should be read as analyst inference.</>}</p>
        </Sec>

        {m.baselines.length > 0 && (
          <Sec t="Structural baselines (lagged, not current-event evidence)">
            <div className="scroll-x"><table className="t"><thead><tr><th>Code</th><th>Country</th><th>Indicator</th><th>Value</th><th>Year</th></tr></thead>
              <tbody>{m.baselines.map((b) => <tr key={b.code} id={`ref-${b.code}`}><td className="mono" style={{ color: "var(--gold)" }}>[{b.code}]</td><td>{b.iso2}</td><td>{b.label}</td><td className="mono">{b.value}</td><td className="mono">{b.year}</td></tr>)}</tbody></table></div>
            <p className="faint" style={{ fontSize: 12, marginBottom: 0 }}>Source: World Bank, Worldwide Governance Indicators, 0 to 100 scale, higher is better. Annual data lags current events.</p>
          </Sec>
        )}

        <Sec t="Reference register (RAPITIS provisional bands)">
          <div className="scroll-x"><table className="t"><thead><tr><th>Ref</th><th>Item</th><th>Source</th><th>Type</th><th>Band</th><th>Date</th></tr></thead>
            <tbody>{m.references.map((x) => (
              <tr key={x.n} id={`ref-${x.n}`}>
                <td className="mono" style={{ color: "var(--gold)" }}>[{x.n}]</td>
                <td><a href={x.url} target="_blank" rel="noopener noreferrer">{x.title}</a>{x.pinned && <span className="chip gold" style={{ marginLeft: 6 }}>pinned</span>}</td>
                <td>{x.source}<div className="faint mono" style={{ fontSize: 10.5 }}>{x.domain}</div></td>
                <td>{typeLabel(x.type)}</td>
                <td><span className={`dot ${x.band === "unrated" ? "" : x.band}`} /> {x.band}{x.band !== x.provisionalBand && <span className="faint"> (was {x.provisionalBand})</span>}</td>
                <td className="mono">{x.publishedAt.slice(0, 10)}</td>
              </tr>))}</tbody></table></div>
          <p className="faint" style={{ fontSize: 12, marginBottom: 0 }}>Bands are automated provisional triage. State-affiliated outlets are excluded from independence counts. Outlets that draw on one upstream count as one stream. Confirm bands before external release.</p>
        </Sec>

        <Sec t="Method and limits">
          <p className="faint" style={{ margin: 0 }}>
            Produced with the {BRAND.producer} workflow, which applies established structured analytic techniques and source evaluation practice. Evidence consists of open-source headlines and short excerpts collected by the console, not full article text. Generated by {m.model} and checked by rule-based citation and confidence controls. {m.toppedUp.length > 0 ? `Live top-up sources used: ${m.toppedUp.join(", ")}. ` : ""}{BRAND.legal} An analyst should review before distribution.
          </p>
        </Sec>
      </div>
    </article>
  );
}
