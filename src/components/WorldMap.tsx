"use client";
import { useEffect, useMemo, useState } from "react";
import { geoEqualEarth, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import { BY_ISO2, BY_NUM, COUNTRIES } from "@/lib/geo/lite";

type Feat = { id?: string | number; properties?: { name?: string }; geometry: any; type: string };

interface Props {
  counts: Map<string, number>;
  selected?: string[];
  onPick: (iso2: string) => void;
}

const W = 960;
const H = 500;

export default function WorldMap({ counts, selected = [], onPick }: Props) {
  const [feats, setFeats] = useState<Feat[] | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    import("world-atlas/countries-110m.json").then((m: any) => {
      if (!live) return;
      const topo = m.default ?? m;
      const fc = feature(topo, topo.objects.countries) as unknown as { features: Feat[] };
      setFeats(fc.features.filter((f) => f.properties?.name !== "Antarctica"));
    });
    return () => {
      live = false;
    };
  }, []);

  const { path, projection } = useMemo(() => {
    const projection = geoEqualEarth().fitExtent([[6, 6], [W - 6, H - 6]], { type: "Sphere" } as any);
    return { projection, path: geoPath(projection) };
  }, []);

  const max = useMemo(() => Math.max(1, ...counts.values()), [counts]);
  const dots = useMemo(() => {
    return COUNTRIES.filter((c) => (counts.get(c.iso2) ?? 0) > 0)
      .map((c) => ({ c, n: counts.get(c.iso2) ?? 0, xy: projection([c.lng, c.lat]) as [number, number] | null }))
      .filter((d) => d.xy)
      .sort((a, b) => b.n - a.n);
  }, [counts, projection]);

  return (
    <div className="map-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="World map of coverage volume by country">
        <path d={path({ type: "Sphere" } as any) ?? ""} fill="#0c1018" stroke="#232a3a" />
        {feats?.map((f, i) => {
          const c = BY_NUM[String(Number(f.id))];
          const n = c ? counts.get(c.iso2) ?? 0 : 0;
          const on = c && selected.includes(c.iso2);
          const a = n ? 0.16 + 0.5 * Math.sqrt(n / max) : 0;
          return (
            <path
              key={i}
              d={path(f as any) ?? ""}
              fill={on ? "rgba(200,169,110,0.55)" : n ? `rgba(200,169,110,${a.toFixed(2)})` : "#141a26"}
              stroke={on ? "#c8a96e" : "#2a3246"}
              strokeWidth={on ? 1.2 : 0.4}
              style={{ cursor: c ? "pointer" : "default" }}
              onClick={() => c && onPick(c.iso2)}
              onMouseMove={(e) => {
                if (!c) return;
                const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setTip({ x: e.clientX - box.left + 12, y: e.clientY - box.top + 12, text: `${c.name}: ${n} item${n === 1 ? "" : "s"}` });
              }}
              onMouseLeave={() => setTip(null)}
            />
          );
        })}
        {dots.slice(0, 40).map((d) => (
          <circle
            key={d.c.iso2}
            cx={d.xy![0]}
            cy={d.xy![1]}
            r={2.5 + 9 * Math.sqrt(d.n / max)}
            fill="rgba(200,169,110,0.25)"
            stroke="#c8a96e"
            strokeWidth={0.8}
            style={{ cursor: "pointer" }}
            onClick={() => onPick(d.c.iso2)}
            onMouseMove={(e) => {
              const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
              setTip({ x: e.clientX - box.left + 12, y: e.clientY - box.top + 12, text: `${BY_ISO2[d.c.iso2].name}: ${d.n} item${d.n === 1 ? "" : "s"}` });
            }}
            onMouseLeave={() => setTip(null)}
          />
        ))}
      </svg>
      {!feats && <div className="empty pulse" style={{ position: "absolute", inset: 0 }}>Loading map</div>}
      {tip && <div className="map-tip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>}
      <div className="legend">Shading and circles show coverage volume in the current window. Volume is not severity.</div>
    </div>
  );
}
