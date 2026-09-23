"use client";
import { ExternalLink, Pin, PinOff, Sparkles } from "lucide-react";
import type { Article } from "@/lib/types";
import { BY_ISO2 } from "@/lib/geo/lite";
import { timeAgo } from "@/lib/analytics";
import type { Ctx } from "./ctx";
import { BandDot, ThemeChip, typeLabel } from "./ui";

export function FeedRow({ a, ctx }: { a: Article; ctx: Ctx }) {
  return (
    <div className="row">
      <BandDot band={a.band} />
      <div>
        <div className="t" onClick={() => ctx.open(a)}>{a.title}</div>
        <div className="meta">
          <span>{a.sourceName}</span>
          <span>{timeAgo(a.publishedAt)}</span>
          {a.countries.slice(0, 2).map((c) => <button key={c} className="chip" onClick={() => ctx.setFilters((p) => ({ ...p, countries: [c] }))}>{BY_ISO2[c]?.name ?? c}</button>)}
          {a.themes.slice(0, 2).map((t) => <ThemeChip key={t} id={t} />)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <a className="btn sm ghost" href={a.url} target="_blank" rel="noopener noreferrer" title="Open source"><ExternalLink size={12} /></a>
      </div>
    </div>
  );
}

export function ArticleCard({ a, ctx }: { a: Article; ctx: Ctx }) {
  const pinned = ctx.isPinned(a.id);
  return (
    <div className="acard">
      <div className="meta" style={{ marginTop: 0 }}>
        <BandDot band={a.band} />
        <span style={{ color: "var(--text)" }}>{a.sourceName}</span>
        <span>{typeLabel(a.sourceType)}</span>
        <span style={{ marginLeft: "auto" }}>{timeAgo(a.publishedAt)}</span>
      </div>
      <div className="t" onClick={() => ctx.open(a)}>{a.title}</div>
      {a.excerpt && <div className="x">{a.excerpt}</div>}
      <div className="meta" style={{ gap: 5 }}>
        {a.countries.slice(0, 3).map((c) => <button key={c} className="chip" onClick={() => ctx.setFilters((p) => ({ ...p, countries: [c] }))}>{BY_ISO2[c]?.name ?? c}</button>)}
        {a.themes.slice(0, 3).map((t) => <ThemeChip key={t} id={t} />)}
        <span className="chip" title="Collection channel">{a.aggregator}</span>
      </div>
      <div className="mono faint" style={{ fontSize: 10.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.domain}</div>
      <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
        <a className="btn sm" href={a.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /> Source</a>
        <button className="btn sm" onClick={() => ctx.open(a)}><Sparkles size={12} /> Analyze</button>
        <button className={`btn sm ${pinned ? "gold" : ""}`} onClick={() => ctx.togglePin(a)}>{pinned ? <PinOff size={12} /> : <Pin size={12} />} {pinned ? "Pinned" : "Pin"}</button>
      </div>
    </div>
  );
}
