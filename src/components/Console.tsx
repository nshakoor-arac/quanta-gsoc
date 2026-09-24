"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import type { Article, ScopeTarget, WindowKey } from "@/lib/types";
import { BRAND } from "@/lib/brand";
import { getJson } from "@/lib/client/api";
import { applyFilters, EMPTY_FILTERS, type Filters } from "@/lib/client/filters";
import { timeAgo } from "@/lib/analytics";
import type { Ctx } from "./ctx";
import Dashboard from "./Dashboard";
import Analytics from "./Analytics";
import NewsNetwork from "./NewsNetwork";
import Reports from "./Reports";
import StatusPanel from "./StatusPanel";
import FilterBar from "./FilterBar";
import Drawer, { type DrawerSpec } from "./Drawer";
import { Seg } from "./ui";

type Tab = "dashboard" | "analytics" | "network" | "reports" | "status";
const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "analytics", label: "Analytics" },
  { id: "network", label: "News Explorer" },
  { id: "reports", label: "Reports" },
  { id: "status", label: "Sources" },
];

export default function Console({ analyst }: { analyst: string }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [win, setWin] = useState<WindowKey>("72h");
  const [all, setAll] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [last, setLast] = useState<string | null>(null);
  const [storeKind, setStoreKind] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [pinned, setPinned] = useState<Article[]>([]);
  const [drawer, setDrawer] = useState<DrawerSpec | null>(null);
  const [seed, setSeed] = useState<ScopeTarget | null>(null);

  const load = useCallback(async (w: WindowKey, quiet = false) => {
    if (!quiet) setLoading(true);
    setErr("");
    try {
      const r = await getJson<{ items: Article[]; meta: { lastFetch: string | null; store: string; warming: boolean } }>(`/api/articles?window=${w}`);
      setAll(r.items);
      setLast(r.meta.lastFetch);
      setStoreKind(r.meta.store);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(win); }, [win, load]);
  useEffect(() => {
    const t = setInterval(() => void load(win, true), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [win, load]);
  useEffect(() => {
    try { const s = sessionStorage.getItem("gsoc-pins"); if (s) setPinned(JSON.parse(s)); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem("gsoc-pins", JSON.stringify(pinned)); } catch { /* ignore */ }
  }, [pinned]);

  const items = useMemo(() => applyFilters(all, filters), [all, filters]);

  const ctx: Ctx = {
    all,
    items,
    win,
    filters,
    setFilters,
    pinned,
    togglePin: (a) => setPinned((p) => (p.some((x) => x.id === a.id) ? p.filter((x) => x.id !== a.id) : p.length >= 40 ? p : [...p, a])),
    isPinned: (id) => pinned.some((x) => x.id === id),
    open: (a) => setDrawer({ kind: "article", article: a }),
    quickCountry: (iso2) => setDrawer({ kind: "country", iso2 }),
    quickFeed: () => setDrawer({ kind: "feed", filters }),
    buildReport: (t) => { setSeed(t); setDrawer(null); setTab("reports"); },
  };

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  const clearSeed = useCallback(() => setSeed(null), []);

  return (
    <div className="shell">
      <header className="topbar no-print">
        <div className="topbar-in">
          <div className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND.logoUrl} alt="Quanta Analytica" />
            <div>
              <div className="brand-t">{BRAND.product}</div>
              <div className="brand-s">{BRAND.tagline}</div>
            </div>
          </div>
          <nav className="tabs" aria-label="Sections">
            {TABS.map((t) => <button key={t.id} className={`tab ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>{t.label}{t.id === "reports" && pinned.length > 0 ? ` (${pinned.length})` : ""}</button>)}
          </nav>
          <div className="top-r">
            <Seg value={win} onChange={setWin} options={[{ v: "24h", l: "24H" }, { v: "72h", l: "72H" }, { v: "7d", l: "7D" }, { v: "30d", l: "30D" }]} />
            <button className="btn sm ghost" onClick={() => void load(win)} title="Reload from the store"><RefreshCw size={13} className={loading ? "spin" : ""} /></button>
            <span className="faint mono" style={{ fontSize: 10.5 }}>{last ? `updated ${timeAgo(last)}` : "no data yet"}</span>
            <span className="chip gold">{analyst}</span>
            <button className="btn sm ghost" onClick={logout} title="Sign out"><LogOut size={13} /></button>
          </div>
        </div>
      </header>

      <main className="main">
        {err && <div className="note bad" style={{ marginBottom: 12 }}>{err}</div>}
        {storeKind === "memory" && <div className="note warn" style={{ marginBottom: 12 }}>The database is not connected, so collected items and saved reports are held in memory and will reset. Connect Supabase to keep them. See the setup guide.</div>}
        {(tab === "dashboard" || tab === "analytics") && <div style={{ marginBottom: 14 }}><FilterBar ctx={ctx} dense /></div>}
        {tab === "dashboard" && <Dashboard ctx={ctx} loading={loading} />}
        {tab === "analytics" && <Analytics ctx={ctx} />}
        {tab === "network" && <NewsNetwork ctx={ctx} loading={loading} />}
        <div style={{ display: tab === "reports" ? "block" : "none" }}><Reports ctx={ctx} seed={seed} clearSeed={clearSeed} /></div>
        {tab === "status" && <StatusPanel onRefreshed={() => void load(win, true)} />}
      </main>

      <footer className="foot no-print">{BRAND.producer} | in partnership with {BRAND.partner} | Open-source evidence only. Automated bands and tags are provisional and require analyst review.</footer>

      {drawer && (
        <Drawer
          spec={drawer}
          win={win}
          onClose={() => setDrawer(null)}
          isPinned={ctx.isPinned}
          togglePin={ctx.togglePin}
          buildReport={(iso2) => ctx.buildReport({ type: "country", id: iso2 })}
        />
      )}
    </div>
  );
}
