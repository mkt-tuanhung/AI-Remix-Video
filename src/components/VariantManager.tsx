"use client";

import { useState } from "react";
import type { PlanningBundle } from "@/lib/services";

const VOICE_OPTS = [
  { v: "", l: "Giữ như bản gốc" },
  { v: "friendly", l: "Gần gũi" },
  { v: "expert", l: "Chuyên gia" },
  { v: "story", l: "Kể chuyện" },
  { v: "news", l: "Tin tức" },
  { v: "sales", l: "Bán hàng" },
];

const VOICE_LABEL: Record<string, string> = {
  friendly: "gần gũi", expert: "chuyên gia", story: "kể chuyện", news: "tin tức", sales: "bán hàng",
};

export function VariantManager({
  projectId,
  planning,
  onReload,
}: {
  projectId: string;
  planning: PlanningBundle;
  onReload: () => Promise<unknown>;
}) {
  const { variants, hooks, renders, qualities } = planning;
  const [open, setOpen] = useState(false);
  const [hookId, setHookId] = useState("");
  const [voiceStyle, setVoiceStyle] = useState("");
  const [cta, setCta] = useState("");
  const [busy, setBusy] = useState(false);

  const master = variants.find((v) => v.is_master) ?? variants[0];

  async function createVariant() {
    setBusy(true);
    try {
      await fetch(`/api/projects/${projectId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hookId: hookId || undefined,
          voiceStyle: voiceStyle || undefined,
          cta: cta.trim() || undefined,
        }),
      });
      setOpen(false);
      setHookId(""); setVoiceStyle(""); setCta("");
      await onReload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card card-pad">
      <div className="row between" style={{ marginBottom: 14 }}>
        <div className="section-title" style={{ margin: 0 }}>Phiên bản & A/B · {variants.length}</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>
          {open ? "Đóng" : "＋ Tạo phiên bản A/B"}
        </button>
      </div>

      {open && (
        <div className="card card-pad" style={{ background: "var(--teal-50)", borderColor: "var(--teal-200)", marginBottom: 16 }}>
          <div className="grid grid-2">
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="label">Đổi hook</label>
              <select className="select" value={hookId} onChange={(e) => setHookId(e.target.value)}>
                <option value="">Giữ hook bản gốc</option>
                {hooks.map((h) => (
                  <option key={h.id} value={h.id}>{h.text.slice(0, 60)}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="label">Đổi giọng đọc</label>
              <select className="select" value={voiceStyle} onChange={(e) => setVoiceStyle(e.target.value)}>
                {VOICE_OPTS.map((o) => (
                  <option key={o.v} value={o.v}>{o.l}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="label">Đổi CTA (tuỳ chọn)</label>
            <input className="input" placeholder="Để trống = giữ CTA bản gốc" value={cta} onChange={(e) => setCta(e.target.value)} />
          </div>
          <div className="row between">
            <span className="hint" style={{ margin: 0 }}>Phiên bản mới sẽ tự sản xuất + render bản cuối riêng.</span>
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={createVariant}>
              {busy ? <span className="spin" /> : null} Tạo & render
            </button>
          </div>
        </div>
      )}

      <div className="stack" style={{ gap: 12 }}>
        {variants.map((v) => {
          const r = renders[v.id];
          const q = qualities[v.id];
          const rendering = !r?.final_path;
          return (
            <div key={v.id} className="row" style={{ gap: 14, alignItems: "flex-start", padding: 12, border: "1px solid var(--line)", borderRadius: 10 }}>
              {r?.final_path ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={r.final_path} controls style={{ width: 90, height: 160, borderRadius: 8, background: "#000", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 90, height: 160, borderRadius: 8, background: "var(--teal-50)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <span className="spin" />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 650 }}>{v.is_master ? "★ Bản gốc" : v.label || "Phiên bản A/B"}</span>
                  {q && <span className={`badge ${q.overall_score >= 85 ? "badge-green" : "badge-amber"}`} style={{ fontSize: 10.5 }}>QA {q.overall_score}</span>}
                  {v.voice_style && <span className="badge badge-gray" style={{ fontSize: 10.5 }}>🎙 {VOICE_LABEL[v.voice_style] ?? v.voice_style}</span>}
                  {rendering && <span className="badge badge-teal" style={{ fontSize: 10.5 }}><span className="dot dot-pulse" />đang render</span>}
                </div>
                <div className="muted" style={{ fontSize: 12.5, marginBottom: 3 }}><b>Hook:</b> {v.hook}</div>
                <div className="muted" style={{ fontSize: 12.5 }}><b>CTA:</b> {v.cta}</div>
                {r?.final_path && (
                  <a className="btn btn-ghost btn-sm" href={r.final_path} download style={{ marginTop: 8 }}>⬇ Tải MP4</a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
