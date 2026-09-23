"use client";
import { useMemo, useState } from "react";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import { Download, Sparkles } from "lucide-react";
import { BY_ISO2 } from "@/lib/geo/lite";
import type { Ctx } from "./ctx";
import FilterBar from "./FilterBar";
import { ArticleCard } from "./ArticleViews";
import { Seg } from "./ui";
import { toggle } from "@/lib/client/filters";

type N = SimulationNodeDatum & { id: string; kind: "src" | "cty"; label: string; n: number; key: string };
type L = SimulationLinkDatum<N> & { w: number };

function Graph({ ctx }: { ctx: Ctx }) {
  const { nodes, links } = useMemo(() => {
    const src = new Map<string, { label: string; n: number }>();
    const cty = new Map<string, number>();
    for (const a of ctx.items) {
      const k = a.domain || a.sourceName;
      const s = src.get(k) ?? { label: a.sourceName, n: 0 };
      s.n++;
      src.set(k, s);
      for (const c of a.countries) cty.set(c, (cty.get(c) ?? 0) + 1);
    }
    const topS = [...src].sort((a, b) => b[1].n - a[1].n).slice(0, 16);
    const topC = [...cty].sort((a, b) => b[1] - a[1]).slice(0, 18);
    const sSet = new Set(topS.map((s) => s[0]));
    const cSet = new Set(topC.map((c) => c[0]));
    const nodes: N[] = [
      ...topS.map(([k, v]) => ({ id: "s:" + k, key: k, kind: "src" as const, label: v.label, n: v.n })),
      ...topC.map(([k, v]) => ({ id: "c:" + k, key: k, kind: "cty" as const, label: BY_ISO2[k]?.name ?? k, n: v })),
    ];
    const w = new Map<string, number>();
    for (const a of ctx.items) {
      const k = a.domain || a.sourceName;
      if (!sSet.has(k)) continue;
      for (const c of a.countries) if (cSet.has(c)) w.set(`s:${k}|c:${c}`, (w.get(`s:${k}|c:${c}`) ?? 0) + 1);
    }
    const links: L[] = [...w].map(([kk, v]) => { const [s, t] = kk.split("|"); return { source: s, target: t, w: v }; });
    const sim = forceSimulation(nodes)
      .force("link", forceLink<N, L>(links).id((d) => d.id).distance(90).strength(0.25))
      .force("charge", forceManyBody().strength(-160))
      .force("center", forceCenter(480, 260))
      .force("collide", forceCollide<N>().radius((d) => 8 + Math.sqrt(d.n) * 2.6))
      .stop();
    for (let i = 0; i < 280; i++) sim.tick();
    return { nodes, links };
  }, [ctx.items]);

  if (nodes.length === 0) return <div className="empty">No items to draw. Widen the window or clear filters.</div>;
  const maxW = Math.max(1, ...links.map((l) => l.w));
  const r = (n: number) => 5 + Math.sqrt(n) * 2.2;
  return (
    <div className="card">
      <svg viewBox="0 0 960 520" style={{ width: "100%", height: "auto" }} role="img" aria-label="Network of sources and countries they cover">
        {links.map((l, i) => {
          const s = l.source as N, t = l.target as N;
          return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="#c8a96e" strokeOpacity={0.08 + 0.45 * (l.w / maxW)} strokeWidth={0.6 + 2.2 * (l.w / maxW)} />;
        })}
        {nodes.map((d) => (
          <g key={d.id} transform={`translate(${d.x},${d.y})`} style={{ cursor: "pointer" }} onClick={() => ctx.setFilters((p) => (d.kind === "cty" ? { ...p, countries: toggle(p.countries, d.key) } : { ...p, q: d.label }))}>
            <circle r={r(d.n)} fill={d.kind === "cty" ? "rgba(200,169,110,0.85)" : "#131722"} stroke={d.kind === "cty" ? "#c8a96e" : "#5b8def"} strokeWidth={1.4} />
            <text y={r(d.n) + 11} textAnchor="middle" fontSize={10} fill={d.kind === "cty" ? "#e6e8ee" : "#9aa3b5"} fontFamily="IBM Plex Sans, sans-serif">{d.label.length > 22 ? d.label.slice(0, 21) + "…" : d.label}</text>
          </g>
        ))}
      </svg>
      <div className="faint mono" style={{ fontSize: 10.5 }}>
        <span style={{ color: "#5b8def" }}>OUTLINED</span> nodes are sources, <span style={{ color: "var(--gold)" }}>GOLD</span> nodes are countries. Links show how often a source covered a country in this window. Click a node to filter the list.
      </div>
    </div>
  );
}

function exportCsv(ctx: Ctx) {
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const rows = [["published_utc", "title", "source", "source_type", "band_provisional", "channel", "countries", "themes", "url"].join(",")].concat(
    ctx.items.map((a) => [a.publishedAt, a.title, a.sourceName, a.sourceType, a.band, a.aggregator, a.countries.join(" "), a.themes.join(" "), a.url].map(esc).join(","))
  );
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const el = document.createElement("a");
  el.href = URL.createObjectURL(blob);
  el.download = `gsoc-news-${new Date().toISOString().slice(0, 10)}.csv`;
  el.click();
  URL.revokeObjectURL(el.href);
}

export default function NewsNetwork({ ctx, loading }: { ctx: Ctx; loading: boolean }) {
  const [view, setView] = useState<"list" | "graph">("list");
  const [page, setPage] = useState(1);
  const per = 48;
  const shown = ctx.items.slice(0, page * per);
  return (
    <div className="grid" style={{ gap: 12 }}>
      <FilterBar ctx={ctx} />
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Seg value={view} onChange={setView} options={[{ v: "list", l: "Articles" }, { v: "graph", l: "Source network" }]} />
        <span className="muted">{ctx.items.length.toLocaleString()} items</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn sm" onClick={ctx.quickFeed} disabled={!ctx.items.length}><Sparkles size={12} /> AI digest of this view</button>
          <button className="btn sm" onClick={() => exportCsv(ctx)} disabled={!ctx.items.length}><Download size={12} /> CSV</button>
        </span>
      </div>
      {view === "graph" ? (
        <Graph ctx={ctx} />
      ) : loading && !ctx.items.length ? (
        <div className="empty pulse">Collecting sources</div>
      ) : ctx.items.length === 0 ? (
        <div className="empty">No items match these filters.</div>
      ) : (
        <>
          <div className="cards">{shown.map((a) => <ArticleCard key={a.id} a={a} ctx={ctx} />)}</div>
          {shown.length < ctx.items.length && <div style={{ textAlign: "center" }}><button className="btn" onClick={() => setPage((p) => p + 1)}>Show more ({ctx.items.length - shown.length} left)</button></div>}
        </>
      )}
    </div>
  );
}
