"use client";
import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { aggregate, momentum } from "@/lib/analytics";
import { WINDOW_HOURS } from "@/lib/types";
import { BY_ISO2 } from "@/lib/geo/lite";
import { themeLabel } from "@/lib/taxonomy";
import { toggle } from "@/lib/client/filters";
import type { Ctx } from "./ctx";
import WorldMap from "./WorldMap";
import { Bars, Card } from "./ui";
import { FeedRow } from "./ArticleViews";

export default function Dashboard({ ctx, loading }: { ctx: Ctx; loading: boolean }) {
  const agg = useMemo(() => aggregate(ctx.items, WINDOW_HOURS[ctx.win]), [ctx.items, ctx.win]);
  const mom = useMemo(() => momentum(ctx.items, WINDOW_HOURS[ctx.win]), [ctx.items, ctx.win]);
  const counts = useMemo(() => new Map(agg.byCountry.map((c) => [c.iso2, c.n])), [agg]);
  const feed = ctx.items.slice(0, 40);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="grid g4">
        <div className="card kpi"><div className="l">Items in window</div><div className="v">{agg.total.toLocaleString()}</div><div className="s">{mom.pct === null ? "Trend not shown, too few items" : `${mom.pct >= 0 ? "+" : ""}${mom.pct}% latest half vs earlier half`}</div></div>
        <div className="card kpi"><div className="l">Sources</div><div className="v">{agg.sources}</div><div className="s">{agg.byAggregator.rss ?? 0} direct RSS, {agg.byAggregator.gdelt ?? 0} GDELT, {agg.byAggregator.reliefweb ?? 0} ReliefWeb</div></div>
        <div className="card kpi"><div className="l">Countries mentioned</div><div className="v">{agg.countries}</div><div className="s">{agg.untagged} items without a theme tag</div></div>
        <div className="card kpi"><div className="l">Independent streams</div><div className="v">{agg.independentStreams}</div><div className="s">Top source share {(agg.topShare * 100).toFixed(0)}%, concentration index {agg.hhi.toFixed(2)}</div></div>
      </div>

      <div className="split">
        <div className="grid" style={{ gap: 14, alignContent: "start" }}>
          <Card title="Coverage map" right={<span className="faint mono" style={{ fontSize: 10.5 }}>click a country</span>}>
            <WorldMap counts={counts} selected={ctx.filters.countries} onPick={(iso) => ctx.setFilters((p) => ({ ...p, countries: toggle(p.countries, iso) }))} />
            {ctx.filters.countries.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                {ctx.filters.countries.map((c) => (
                  <span key={c} style={{ display: "inline-flex", gap: 6 }}>
                    <button className="btn sm" onClick={() => ctx.quickCountry(c)}><Sparkles size={12} /> Quick brief: {BY_ISO2[c]?.name}</button>
                    <button className="btn sm" onClick={() => ctx.buildReport({ type: "country", id: c })}>Full SitRep</button>
                  </span>
                ))}
              </div>
            )}
          </Card>
          <div className="grid g2">
            <Card title="Themes"><Bars rows={agg.byTheme.map((t) => ({ key: t.id, label: themeLabel(t.id), n: t.n }))} onPick={(k) => ctx.setFilters((p) => ({ ...p, themes: toggle(p.themes, k as never) }))} active={ctx.filters.themes} /></Card>
            <Card title="Most mentioned countries"><Bars rows={agg.byCountry.slice(0, 9).map((c) => ({ key: c.iso2, label: BY_ISO2[c.iso2]?.name ?? c.iso2, n: c.n }))} onPick={(k) => ctx.setFilters((p) => ({ ...p, countries: toggle(p.countries, k) }))} active={ctx.filters.countries} /></Card>
          </div>
        </div>

        <Card title="Live feed" right={<button className="btn sm" onClick={ctx.quickFeed} disabled={!ctx.items.length}><Sparkles size={12} /> Digest</button>}>
          {loading && !ctx.items.length ? (
            <div className="empty pulse">Collecting sources. The first load can take up to a minute.</div>
          ) : feed.length === 0 ? (
            <div className="empty">No items match. Widen the window or clear filters.</div>
          ) : (
            <div className="feed" style={{ maxHeight: 980, overflowY: "auto" }}>{feed.map((a) => <FeedRow key={a.id} a={a} ctx={ctx} />)}</div>
          )}
        </Card>
      </div>
    </div>
  );
}
