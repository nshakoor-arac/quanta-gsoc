"use client";
import { useMemo } from "react";
import { aggregate } from "@/lib/analytics";
import { WINDOW_HOURS } from "@/lib/types";
import { THEMES, themeLabel } from "@/lib/taxonomy";
import { BAND_LABEL } from "@/lib/sources/registry";
import type { Ctx } from "./ctx";
import { Bars, Card, typeLabel } from "./ui";

function Series({ pts, unit }: { pts: { t: number; n: number }[]; unit: "hour" | "day" }) {
  const W = 720, H = 200, P = 28;
  const max = Math.max(1, ...pts.map((p) => p.n));
  const x = (i: number) => P + (i * (W - P * 2)) / Math.max(1, pts.length - 1);
  const y = (n: number) => H - P - (n / max) * (H - P * 2);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.n).toFixed(1)}`).join(" ");
  const area = `${line} L${x(pts.length - 1)},${H - P} L${x(0)},${H - P} Z`;
  const fmt = (t: number) => { const d = new Date(t); return unit === "hour" ? `${String(d.getUTCHours()).padStart(2, "0")}:00` : `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };
  const ticks = [0, Math.floor(pts.length / 3), Math.floor((2 * pts.length) / 3), pts.length - 1].filter((v, i, a) => a.indexOf(v) === i && pts[v]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Items published over time">
      {[0, 0.5, 1].map((f) => <line key={f} x1={P} x2={W - P} y1={y(max * f)} y2={y(max * f)} stroke="#232a3a" strokeDasharray="3 4" />)}
      <path d={area} fill="rgba(200,169,110,0.15)" />
      <path d={line} fill="none" stroke="#c8a96e" strokeWidth={1.6} />
      {ticks.map((i) => <text key={i} x={x(i)} y={H - 8} fill="#6b7489" fontSize={10} textAnchor="middle" fontFamily="IBM Plex Mono, monospace">{fmt(pts[i].t)}</text>)}
      <text x={P} y={14} fill="#6b7489" fontSize={10} fontFamily="IBM Plex Mono, monospace">peak {max} per {unit}, UTC</text>
    </svg>
  );
}

export default function Analytics({ ctx }: { ctx: Ctx }) {
  const agg = useMemo(() => aggregate(ctx.items, WINDOW_HOURS[ctx.win]), [ctx.items, ctx.win]);
  const heatMax = Math.max(1, ...agg.themeByRegion.flatMap((r) => Object.values(r.counts)));
  const bandTot = Math.max(1, agg.total);
  const risky = agg.topShare > 0.35 || agg.hhi > 0.2;

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="note">These analytics describe the collected news stream, not events on the ground. Volume reflects what outlets chose to publish. It is not a measure of severity, and a quiet feed is not evidence of a quiet country.</div>
      <div className="split">
        <Card title="Publication tempo"><Series pts={agg.series} unit={agg.seriesUnit} /></Card>
        <Card title="Source quality mix">
          {(["green", "amber", "red", "unrated"] as const).map((b) => (
            <div className="bar" key={b}>
              <span><span className={`dot ${b === "unrated" ? "" : b}`} /> {BAND_LABEL[b]}</span>
              <div className="tr"><div className="fl" style={{ width: `${(agg.byBand[b] / bandTot) * 100}%`, background: b === "green" ? "var(--green)" : b === "amber" ? "var(--amber)" : b === "red" ? "var(--red)" : "var(--faint)" }} /></div>
              <span className="n">{agg.byBand[b]}</span>
            </div>
          ))}
          <p className="faint" style={{ fontSize: 12, marginBottom: 0 }}>Bands are provisional automated triage from the source register. Confirm or override them before relying on an item.</p>
        </Card>
      </div>
      <div className="grid g2">
        <Card title="Source concentration" right={<span className={`chip ${risky ? "gold" : ""}`}>{risky ? "concentrated" : "diverse"}</span>}>
          <p className="muted" style={{ marginTop: 0 }}>Top source share <b>{(agg.topShare * 100).toFixed(0)}%</b>. Herfindahl index <b>{agg.hhi.toFixed(2)}</b> (0 is fully diverse, 1 is a single source). Independent upstream streams: <b>{agg.independentStreams}</b>.</p>
          {risky && <div className="note warn" style={{ marginBottom: 10 }}>The stream leans on a few outlets. Corroborate through sources outside the top three before treating a pattern as established.</div>}
          <div className="scroll-x">
            <table className="t"><thead><tr><th>Source</th><th>Type</th><th>Items</th></tr></thead>
              <tbody>{agg.bySource.slice(0, 14).map((s) => <tr key={s.domain + s.name}><td>{s.name}</td><td className="faint">{typeLabel(s.type)}</td><td className="mono">{s.n}</td></tr>)}</tbody></table>
          </div>
        </Card>
        <Card title="Theme by region (item counts)">
          <div className="scroll-x">
            <table className="t">
              <thead><tr><th>Region</th>{THEMES.map((t) => <th key={t.id} title={t.label}>{t.label.slice(0, 4)}</th>)}</tr></thead>
              <tbody>
                {agg.themeByRegion.map((r) => (
                  <tr key={r.region}>
                    <td style={{ whiteSpace: "nowrap" }}>{r.region}</td>
                    {THEMES.map((t) => {
                      const n = r.counts[t.id] ?? 0;
                      return <td key={t.id}><span className="heat" style={{ background: n ? `rgba(200,169,110,${(0.12 + 0.6 * (n / heatMax)).toFixed(2)})` : "transparent", color: n ? "#fff" : "var(--faint)" }}>{n || ""}</span></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="faint" style={{ fontSize: 12, marginBottom: 0 }}>Theme tags come from transparent keyword rules on titles and excerpts. An item can carry several themes.</p>
        </Card>
      </div>
      <Card title="Theme totals"><Bars rows={agg.byTheme.map((t) => ({ key: t.id, label: themeLabel(t.id), n: t.n }))} /></Card>
    </div>
  );
}
