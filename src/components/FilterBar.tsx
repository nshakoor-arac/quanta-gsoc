"use client";
import { Search, X } from "lucide-react";
import { COUNTRIES, REGIONS } from "@/lib/geo/lite";
import { THEMES } from "@/lib/taxonomy";
import { EMPTY_FILTERS, isFiltered, toggle } from "@/lib/client/filters";
import type { Ctx } from "./ctx";
import { TYPE_LABEL } from "@/lib/sources/registry";
import type { SourceType } from "@/lib/types";

const TYPES: SourceType[] = ["wire", "broadcaster", "newspaper", "igo", "ngo", "thinktank", "specialist", "government", "state-media", "aggregator", "unclassified"];

export default function FilterBar({ ctx, dense = false }: { ctx: Ctx; dense?: boolean }) {
  const f = ctx.filters;
  const set = ctx.setFilters;
  return (
    <div className="card" style={{ padding: "10px 12px" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <Search size={14} style={{ position: "absolute", left: 9, top: 10, color: "var(--faint)" }} />
          <input className="input" style={{ width: "100%", paddingLeft: 28 }} placeholder="Search titles, excerpts, sources" value={f.q} onChange={(e) => set((p) => ({ ...p, q: e.target.value }))} />
        </div>
        <select className="select" value="" onChange={(e) => e.target.value && set((p) => ({ ...p, countries: p.countries.includes(e.target.value) ? p.countries : [...p.countries, e.target.value] }))} aria-label="Add country filter">
          <option value="">Country</option>
          {COUNTRIES.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.iso2} value={c.iso2}>{c.name}</option>)}
        </select>
        <select className="select" value="" onChange={(e) => e.target.value && set((p) => ({ ...p, regions: p.regions.includes(e.target.value) ? p.regions : [...p.regions, e.target.value] }))} aria-label="Add region filter">
          <option value="">Region</option>
          {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="select" value={f.agg} onChange={(e) => set((p) => ({ ...p, agg: e.target.value as typeof f.agg }))} aria-label="Collection channel">
          <option value="">All channels</option>
          <option value="rss">Direct RSS</option>
          <option value="gdelt">GDELT</option>
          <option value="reliefweb">ReliefWeb</option>
        </select>
        {isFiltered(f) && <button className="btn sm ghost" onClick={() => set(EMPTY_FILTERS)}><X size={12} /> Clear</button>}
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 9 }}>
        {THEMES.map((t) => (
          <button key={t.id} className={`chip ${f.themes.includes(t.id) ? "on" : ""}`} onClick={() => set((p) => ({ ...p, themes: toggle(p.themes, t.id) }))}>{t.label}</button>
        ))}
      </div>
      {!dense && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
          <span className="faint mono" style={{ fontSize: 10.5 }}>BAND</span>
          {(["green", "amber", "red", "unrated"] as const).map((b) => (
            <button key={b} className={`chip ${f.bands.includes(b) ? "on" : ""}`} onClick={() => set((p) => ({ ...p, bands: toggle(p.bands, b) }))}><span className={`dot ${b === "unrated" ? "" : b}`} /> {b}</button>
          ))}
          <span className="faint mono" style={{ fontSize: 10.5, marginLeft: 8 }}>TYPE</span>
          {TYPES.map((t) => (
            <button key={t} className={`chip ${f.types.includes(t) ? "on" : ""}`} onClick={() => set((p) => ({ ...p, types: toggle(p.types, t) }))}>{TYPE_LABEL[t]}</button>
          ))}
        </div>
      )}
      {(f.countries.length > 0 || f.regions.length > 0) && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
          {f.countries.map((c) => <button key={c} className="chip gold" onClick={() => set((p) => ({ ...p, countries: p.countries.filter((x) => x !== c) }))}>{COUNTRIES.find((x) => x.iso2 === c)?.name ?? c} <X size={10} /></button>)}
          {f.regions.map((r) => <button key={r} className="chip gold" onClick={() => set((p) => ({ ...p, regions: p.regions.filter((x) => x !== r) }))}>{r} <X size={10} /></button>)}
        </div>
      )}
    </div>
  );
}
