"use client";

import { useState } from "react";

export default function Login() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Sai mật khẩu");
      }
      // vào thẳng trang được yêu cầu (hoặc trang chủ)
      const next = new URLSearchParams(window.location.search).get("next") || "/";
      window.location.href = next;
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <form onSubmit={submit} className="card card-pad" style={{ width: "100%", maxWidth: 380 }}>
        <div className="brand" style={{ padding: "4px 0 18px" }}>
          <div className="brand-mark">✦</div>
          <div>
            <div className="brand-name">AI Remix Video</div>
            <div className="brand-sub">Nhập mật khẩu để tiếp tục</div>
          </div>
        </div>
        {err && <div className="banner warn" style={{ marginBottom: 14 }}>⚠️ {err}</div>}
        <div className="field">
          <label className="label">Mật khẩu</label>
          <input
            className="input"
            type="password"
            autoFocus
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <button className="btn btn-primary" disabled={busy || !pw} style={{ width: "100%", justifyContent: "center" }}>
          {busy ? <span className="spin" /> : null} Vào app
        </button>
      </form>
    </div>
  );
}
