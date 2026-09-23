"use client";
import type { ReactNode } from "react";
import type { Band } from "@/lib/types";
import { THEME_MAP } from "@/lib/taxonomy";
import { BAND_LABEL, TYPE_LABEL } from "@/lib/sources/registry";
import type { SourceType } from "@/lib/types";

export function BandDot({ band }: { band: Band }) {
  const cls = band === "green" ? "green" : band === "amber" ? "amber" : band === "red" ? "red" : "";
  return <span className={`dot ${cls}`} title={BAND_LABEL[band]} />;
}

export function ThemeChip({ id, onClick, on }: { id: string; onClick?: () => void; on?: boolean }) {
  const label = THEME_MAP[id as keyof typeof THEME_MAP]?.label ?? id;
  return onClick ? (
    <button className={`chip ${on ? "on" : ""}`} onClick={onClick}>{label}</button>
  ) : (
    <span className="chip">{label}</span>
  );
}

export function typeLabel(t: string) {
  return TYPE_LABEL[t as SourceType] ?? t;
}

export function Badge({ level }: { level: string }) {
  return <span className={`badge ${level}`}>{level}</span>;
}

export function Card({ title, right, children, className = "" }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`card ${className}`}>
      {title && (
        <h3>
          <span>{title}</span>
          {right}
        </h3>
      )}
      {children}
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.v} className={o.v === value ? "on" : ""} onClick={() => onChange(o.v)}>{o.l}</button>
      ))}
    </div>
  );
}

/** Renders inline citation markers [3] and [B2] as anchors into the reference register. */
export function Cited({ text, prefix = "ref" }: { text: string; prefix?: string }) {
  const parts = String(text ?? "").split(/(\[B?\d+\])/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = /^\[(B?\d+)\]$/.exec(p);
        if (!m) return <span key={i}>{p}</span>;
        return (
          <a key={i} className="cite" href={`#${prefix}-${m[1]}`}>{m[1]}</a>
        );
      })}
    </>
  );
}

export function Bars({ rows, max, onPick, active }: { rows: { key: string; label: string; n: number }[]; max?: number; onPick?: (key: string) => void; active?: string[] }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.n));
  return (
    <div>
      {rows.map((r) => (
        <div className="bar" key={r.key}>
          {onPick ? (
            <button onClick={() => onPick(r.key)} style={{ color: active?.includes(r.key) ? "var(--gold)" : undefined }} title={r.label}>{r.label}</button>
          ) : (
            <span title={r.label} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
          )}
          <div className="tr"><div className="fl" style={{ width: `${(r.n / m) * 100}%` }} /></div>
          <span className="n">{r.n}</span>
        </div>
      ))}
    </div>
  );
}
