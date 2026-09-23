"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BRAND } from "@/lib/brand";

function Form() {
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const notice = params.get("notice");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, name: name || undefined }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Sign in failed.");
      window.location.href = "/";
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <form onSubmit={submit} className="card" style={{ width: "min(420px, 100%)", padding: 28 }}>
        <div className="brand" style={{ marginBottom: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND.logoUrl} alt="Quanta Analytica" />
          <div>
            <div className="brand-t">{BRAND.product}</div>
            <div className="brand-s">{BRAND.tagline}</div>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>Enter the team access code to open the console.</p>
        {notice === "unconfigured" && (
          <div className="note bad" style={{ marginBottom: 12 }}>
            The server has no access code yet. Set APP_ACCESS_CODE and SESSION_SECRET in your hosting environment, then redeploy.
          </div>
        )}
        <label className="eyebrow">Your name (shown on reports)</label>
        <input className="input" style={{ width: "100%", margin: "6px 0 14px" }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Analyst name" maxLength={60} />
        <label className="eyebrow">Access code</label>
        <input className="input" style={{ width: "100%", margin: "6px 0 14px" }} type="password" value={code} onChange={(e) => setCode(e.target.value)} autoFocus autoComplete="current-password" />
        {err && <div className="note bad" style={{ marginBottom: 12 }}>{err}</div>}
        <button className="btn gold" style={{ width: "100%", justifyContent: "center" }} disabled={busy || !code}>{busy ? "Checking" : "Open console"}</button>
        <p className="faint mono" style={{ fontSize: 10.5, marginBottom: 0, marginTop: 18 }}>{BRAND.producer}</p>
      </form>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
