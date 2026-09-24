"use client";
import { useMemo, useRef, useState } from "react";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import { Download, Minus, Plus, RotateCcw, Sparkles } from "lucide-react";
import { BY_ISO2 } from "@/lib/geo/lite";
import { themeLabel } from "@/lib/taxonomy";
import type { Ctx } from "./ctx";
import FilterBar from "./FilterBar";
import { ArticleCard } from "./ArticleViews";
import { toggle } from "@/lib/client/filters";

type Kind = "src" | "cty" | "theme";
type N = SimulationNodeDatum & { id: string; kind: Kind; label: string; n: number; key: string };
type L = SimulationLinkDatum<N> & { w: number };
type Viewport = { x: number; y: number; k: number };

function NetworkExplorer({ ctx }: { ctx: Ctx }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const { nodes, links, connected } = useMemo(() => {
    const src = new Map<string, { label: string; n: number }>();
    const cty = new Map<string, number>();
    const themes = new Map<string, number>();

    for (const a of ctx.items) {
      const sk = a.domain || a.sourceName;
      const s = src.get(sk) ?? { label: a.sourceName, n: 0 };
      s.n++;
      src.set(sk, s);
      for (const c of a.countries) cty.set(c, (cty.get(c) ?? 0) + 1);
      for (const t of a.themes) themes.set(t, (themes.get(t) ?? 0) + 1);
    }

    const topS = [...src].sort((a, b) => b[1].n - a[1].n).slice(0, 16);
    const topC = [...cty].sort((a, b) => b[1] - a[1]).slice(0, 16);
    const topT = [...themes].sort((a, b) => b[1] - a[1]).slice(0, 9);
    const sSet = new Set(topS.map(([k]) => k));
    const cSet = new Set(topC.map(([k]) => k));
    const tSet = new Set(topT.map(([k]) => k));

    const nodes: N[] = [
      ...topS.map(([k, v]) => ({ id: "s:" + k, key: k, kind: "src" as const, label: v.label, n: v.n })),
      ...topC.map(([k, v]) => ({ id: "c:" + k, key: k, kind: "cty" as const, label: BY_ISO2[k]?.name ?? k, n: v })),
      ...topT.map(([k, v]) => ({ id: "t:" + k, key: k, kind: "theme" as const, label: themeLabel(k), n: v })),
    ];

    const weights = new Map<string, number>();
    const add = (a: string, b: string) => {
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      weights.set(key, (weights.get(key) ?? 0) + 1);
    };

    for (const a of ctx.items) {
      const sk = a.domain || a.sourceName;
      if (!sSet.has(sk)) continue;
      const sid = "s:" + sk;
      for (const c of a.countries) if (cSet.has(c)) add(sid, "c:" + c);
      for (const t of a.themes) if (tSet.has(t)) add(sid, "t:" + t);
    }

    const links: L[] = [...weights].map(([key, w]) => {
      const [source, target] = key.split("|");
      return { source, target, w };
    });

    const sim = forceSimulation(nodes)
      .force("link", forceLink<N, L>(links).id((d) => d.id).distance((l) => 95 - Math.min(35, l.w * 2)).strength(0.22))
      .force("charge", forceManyBody().strength(-210))
      .force("center", forceCenter(600, 270))
      .force("collide", forceCollide<N>().radius((d) => 13 + Math.sqrt(d.n) * 2.8))
      .stop();
    for (let i = 0; i < 320; i++) sim.tick();

    const connected = new Map<string, Set<string>>();
    for (const l of links) {
      const s = typeof l.source === "string" ? l.source : l.source.id;
      const t = typeof l.target === "string" ? l.target : l.target.id;
      if (!connected.has(s)) connected.set(s, new Set());
      if (!connected.has(t)) connected.set(t, new Set());
      connected.get(s)!.add(t);
      connected.get(t)!.add(s);
    }
    return { nodes, links, connected };
  }, [ctx.items]);

  const maxW = Math.max(1, ...links.map((l) => l.w));
  const radius = (d: N) => 6 + Math.min(17, Math.sqrt(d.n) * 2.35);
  const isActive = (d: N) =>
    d.kind === "cty" ? ctx.filters.countries.includes(d.key) :
    d.kind === "theme" ? ctx.filters.themes.includes(d.key as never) :
    ctx.filters.q.toLowerCase() === d.label.toLowerCase();

  const clickNode = (d: N) => {
    if (d.kind === "cty") ctx.setFilters((p) => ({ ...p, countries: toggle(p.countries, d.key) }));
    else if (d.kind === "theme") ctx.setFilters((p) => ({ ...p, themes: toggle(p.themes, d.key as never) }));
    else ctx.setFilters((p) => ({ ...p, q: p.q.toLowerCase() === d.label.toLowerCase() ? "" : d.label }));
  };

  const visibleForHover = (id: string) => !hovered || hovered === id || connected.get(hovered)?.has(id);
  const zoom = (factor: number) => setViewport((v) => ({ ...v, k: Math.max(0.6, Math.min(2.5, v.k * factor)) }));

  if (nodes.length === 0) return <div className="network-shell"><div className="empty">No network to draw. Widen the window or clear filters.</div></div>;

  return (
    <section className="network-shell" aria-label="Interactive news relationship network">
      <div className="network-head">
        <div>
          <div className="eyebrow">Relationship map</div>
          <div className="network-title">Live News Explorer</div>
          <div className="faint" style={{ fontSize: 11.5 }}>The graph recomputes from the current filtered article set. Hover to isolate relationships. Click a node to filter.</div>
        </div>
        <div className="network-tools">
          <span className="chip">{nodes.length} nodes</span>
          <span className="chip">{links.length} links</span>
          <button className="btn sm ghost" onClick={() => zoom(1.15)} title="Zoom in"><Plus size={13} /></button>
          <button className="btn sm ghost" onClick={() => zoom(0.87)} title="Zoom out"><Minus size={13} /></button>
          <button className="btn sm ghost" onClick={() => setViewport({ x: 0, y: 0, k: 1 })} title="Reset view"><RotateCcw size={13} /></button>
        </div>
      </div>

      <div className="network-canvas">
        <svg
          viewBox="0 0 1200 540"
          role="img"
          aria-label="Network of news sources, countries and themes"
          onWheel={(e) => {
            e.preventDefault();
            zoom(e.deltaY < 0 ? 1.08 : 0.92);
          }}
          onPointerDown={(e) => {
            if ((e.target as Element).closest("[data-node]")) return;
            drag.current = { x: e.clientX, y: e.clientY, vx: viewport.x, vy: viewport.y };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const scale = 1200 / Math.max(1, e.currentTarget.getBoundingClientRect().width);
            setViewport((v) => ({ ...v, x: drag.current!.vx + (e.clientX - drag.current!.x) * scale, y: drag.current!.vy + (e.clientY - drag.current!.y) * scale }));
          }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
        >
          <defs>
            <radialGradient id="net-bg" cx="50%" cy="45%" r="70%">
              <stop offset="0%" stopColor="#131a28" />
              <stop offset="100%" stopColor="#0b0e14" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width="1200" height="540" fill="url(#net-bg)" />
          <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.k})`}>
            {links.map((l, i) => {
              const s = l.source as N;
              const t = l.target as N;
              const hot = !hovered || s.id === hovered || t.id === hovered;
              return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} className="network-link" opacity={hot ? 0.16 + 0.58 * (l.w / maxW) : 0.035} strokeWidth={0.55 + 2.6 * (l.w / maxW)} />;
            })}
            {nodes.map((d) => {
              const r = radius(d);
              const active = isActive(d);
              const dim = !visibleForHover(d.id);
              return (
                <g
                  key={d.id}
                  data-node
                  transform={`translate(${d.x},${d.y})`}
                  className={`network-node ${d.kind} ${active ? "active" : ""}`}
                  opacity={dim ? 0.16 : 1}
                  onPointerEnter={() => setHovered(d.id)}
                  onPointerLeave={() => setHovered(null)}
                  onClick={() => clickNode(d)}
                >
                  <circle r={r + (active ? 3 : 0)} className="network-halo" />
                  <circle r={r} className="network-core" />
                  <text y={r + 13} textAnchor="middle" className="network-label">{d.label.length > 24 ? d.label.slice(0, 23) + "…" : d.label}</text>
                  <title>{d.label}: {d.n} matching item{d.n === 1 ? "" : "s"}</title>
                </g>
              );
            })}
          </g>
        </svg>
        {hovered && (() => {
          const d = nodes.find((n) => n.id === hovered);
          return d ? <div className="network-hover"><b>{d.label}</b><span>{d.n} matching item{d.n === 1 ? "" : "s"}</span></div> : null;
        })()}
      </div>

      <div className="network-legend">
        <span><i className="network-key source" /> Sources</span>
        <span><i className="network-key country" /> Countries</span>
        <span><i className="network-key theme" /> Themes</span>
        <span className="faint">Drag background to pan. Scroll or use controls to zoom.</span>
      </div>
    </section>
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
  const [page, setPage] = useState(1);
  const per = 48;
  const shown = ctx.items.slice(0, page * per);

  return (
    <div className="grid" style={{ gap: 12 }}>
      <FilterBar ctx={ctx} />
      <NetworkExplorer ctx={ctx} />
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span className="muted">{ctx.items.length.toLocaleString()} matching items</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn sm" onClick={ctx.quickFeed} disabled={!ctx.items.length}><Sparkles size={12} /> AI digest of this view</button>
          <button className="btn sm" onClick={() => exportCsv(ctx)} disabled={!ctx.items.length}><Download size={12} /> CSV</button>
        </span>
      </div>

      {loading && !ctx.items.length ? (
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
