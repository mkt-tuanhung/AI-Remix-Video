"use client";

import { useState } from "react";
import type { PlanningBundle } from "@/lib/services";
import type { ProjectStatus } from "@/lib/types";

export function StoryClips({
  projectId,
  status,
  planning,
  onReload,
}: {
  projectId: string;
  status: ProjectStatus;
  planning: PlanningBundle;
  onReload: () => Promise<unknown>;
}) {
  const { variant, scenes } = planning;
  const [copied, setCopied] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [music, setMusic] = useState(false);

  const uploaded = scenes.filter((s) => s.clip_url).length;
  const producing = status === "RENDERING_FINAL";
  const done = status === "COMPLETED";

  async function copyPrompt(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  }

  async function uploadClip(sceneId: string, file: File) {
    setUploading(sceneId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await fetch(`/api/scenes/${sceneId}/clip`, { method: "POST", body: fd });
      await onReload();
    } finally {
      setUploading(null);
    }
  }

  async function assemble() {
    setBusy(true);
    try {
      await fetch(`/api/projects/${projectId}/assemble`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captions, music }),
      });
      await onReload();
    } finally {
      setBusy(false);
    }
  }

  if (!scenes.length) return null;

  return (
    <div className="stack" style={{ gap: 22 }}>
      {/* Dàn nhân vật */}
      {variant?.characters && variant.characters.length > 0 && (
        <div className="card card-pad">
          <div className="section-title">Dàn nhân vật (giữ nhất quán mọi cảnh)</div>
          <div className="stack" style={{ gap: 8 }}>
            {variant.characters.map((c, i) => (
              <div key={i} style={{ fontSize: 13 }}>
                <b>{c.name}:</b> <span className="muted">{c.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="banner">
        🎬 <b>Cách làm:</b> mỗi cảnh có <b>ảnh gốc</b> + <b>prompt Veo</b>. Vào{" "}
        <a href="https://labs.google/flow" target="_blank" rel="noreferrer" style={{ color: "var(--teal-700)", fontWeight: 600 }}>Google Flow</a>{" "}
        → upload ảnh gốc + dán prompt → tạo clip (≤8s) → tải clip về → bấm "Tải clip" ở cảnh tương ứng. Mẹo nối liền: dùng <b>khung cuối</b> clip trước làm ảnh đầu clip sau.
      </div>

      {/* Từng cảnh */}
      {scenes.map((sc) => (
        <div key={sc.id} className="card card-pad">
          <div className="row" style={{ gap: 16, alignItems: "flex-start" }}>
            {/* ảnh gốc */}
            <div style={{ width: 120, flexShrink: 0 }}>
              <div style={{ borderRadius: 8, overflow: "hidden", background: "#0c2b28", aspectRatio: "9/16" }}>
                {sc.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sc.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : null}
              </div>
              {sc.image_url && (
                <a className="btn btn-ghost btn-sm" href={sc.image_url} download style={{ marginTop: 6, width: "100%", justifyContent: "center", fontSize: 12 }}>⬇ Tải ảnh gốc</a>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row between" style={{ marginBottom: 6 }}>
                <b>Cảnh {sc.order + 1}</b>
                {sc.clip_url ? (
                  <span className="badge badge-green"><span className="dot" />Đã có clip</span>
                ) : (
                  <span className="badge badge-gray">chưa có clip</span>
                )}
              </div>
              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{sc.narration}</div>
              {sc.dialogue && sc.dialogue.length > 0 && (
                <div className="stack" style={{ gap: 2, marginBottom: 8 }}>
                  {sc.dialogue.map((d, i) => (
                    <div key={i} style={{ fontSize: 12.5 }}><b style={{ color: "var(--teal-700)" }}>{d.speaker}:</b> "{d.text}"</div>
                  ))}
                </div>
              )}

              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-ghost btn-sm" onClick={() => copyPrompt(sc.id, sc.veo_prompt || "")}>
                  {copied === sc.id ? "✓ Đã copy" : "📋 Copy prompt Veo"}
                </button>
                <label className="btn btn-primary btn-sm" style={{ cursor: "pointer" }}>
                  {uploading === sc.id ? <span className="spin" /> : sc.clip_url ? "🔁 Thay clip" : "⬆ Tải clip"}
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm"
                    style={{ display: "none" }}
                    onChange={(e) => e.target.files?.[0] && uploadClip(sc.id, e.target.files[0])}
                  />
                </label>
                {sc.clip_url && (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video src={sc.clip_url} controls style={{ height: 80, borderRadius: 6, background: "#000" }} />
                )}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Ghép phim */}
      {!done && (
        <div className="card card-pad" style={{ borderColor: "var(--teal-300)", background: "var(--teal-50)" }}>
          <div className="row between" style={{ flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 650, marginBottom: 4 }}>Ghép phim · {uploaded}/{scenes.length} clip</div>
              <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Giữ nguyên voice + tiếng động của clip Flow. App chỉ nối + (tuỳ chọn) phụ đề/nhạc.</div>
              <div className="row" style={{ gap: 16 }}>
                <label className="row" style={{ gap: 6, cursor: "pointer", fontSize: 13 }}>
                  <input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} style={{ accentColor: "var(--teal-600)" }} /> Phụ đề
                </label>
                <label className="row" style={{ gap: 6, cursor: "pointer", fontSize: 13 }}>
                  <input type="checkbox" checked={music} onChange={(e) => setMusic(e.target.checked)} style={{ accentColor: "var(--teal-600)" }} /> Thêm nhạc nền
                </label>
              </div>
            </div>
            <button className="btn btn-primary" disabled={busy || producing || uploaded === 0} onClick={assemble}>
              {(busy || producing) ? <span className="spin" /> : null}
              {producing ? "Đang ghép…" : "Ghép phim"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
