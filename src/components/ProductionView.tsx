"use client";

import { useState } from "react";
import { VariantManager } from "./VariantManager";
import type { PlanningBundle } from "@/lib/services";
import type { ProjectStatus, QualityReport } from "@/lib/types";

const PRODUCING = new Set([
  "GENERATING_VOICE",
  "MIXING_AUDIO",
  "BUILDING_TIMELINE",
  "RENDERING_PREVIEW",
]);

const VOICE_LABEL: Record<string, string> = {
  openai: "OpenAI TTS",
  elevenlabs: "ElevenLabs",
  "macos-say": "Giọng hệ thống (macOS)",
  silent: "Im lặng (chưa cắm TTS)",
  unknown: "—",
};

const QMETRICS: { key: keyof QualityReport; label: string }[] = [
  { key: "scene_voice_match", label: "Khớp cảnh–lời" },
  { key: "fact_consistency", label: "Đúng dữ kiện" },
  { key: "voice_quality", label: "Voice" },
  { key: "caption_sync", label: "Phụ đề" },
  { key: "music_ducking", label: "Cân bằng âm thanh" },
  { key: "creative_difference", label: "Khác biệt sáng tạo" },
  { key: "platform_fit", label: "Hợp nền tảng" },
];

export function ProductionView({
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
  const { render, quality } = planning;
  const [busy, setBusy] = useState(false);

  async function post(url: string) {
    setBusy(true);
    try {
      await fetch(url, { method: "POST" });
      await onReload();
    } finally {
      setBusy(false);
    }
  }

  // Gate 3: duyệt media → sản xuất.
  const gate3 = status === "WAITING_FOR_MEDIA_APPROVAL";
  const producing = PRODUCING.has(status);
  const previewReady = !!render?.preview_path;
  const finalReady = !!render?.final_path;
  const qaPassed = (quality?.overall_score ?? 0) >= 85;

  return (
    <div className="stack" style={{ gap: 22 }}>
      {gate3 && (
        <div className="card card-pad" style={{ borderColor: "var(--teal-300)", background: "var(--teal-50)" }}>
          <div className="row between" style={{ flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 650, marginBottom: 4 }}>Storyboard đã sẵn sàng · Gate 3</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Duyệt để sản xuất: tạo voice AI → phụ đề → render bản nháp → kiểm định chất lượng.
              </div>
            </div>
            <button className="btn btn-primary" disabled={busy} onClick={() => post(`/api/projects/${projectId}/approve-media`)}>
              {busy ? <span className="spin" /> : null}
              Duyệt & sản xuất video
            </button>
          </div>
        </div>
      )}

      {producing && (
        <div className="card card-pad">
          <div className="row muted"><span className="spin" /> Đang sản xuất video (voice, phụ đề, render nháp)…</div>
        </div>
      )}

      {/* Voice + phụ đề */}
      {render?.voice_path && (
        <div className="card card-pad">
          <div className="section-title">Âm thanh & phụ đề</div>
          <div className="row" style={{ gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <span className={`badge ${render.voice_provider === "silent" ? "badge-amber" : "badge-green"}`}>
              🎙 {VOICE_LABEL[render.voice_provider] ?? render.voice_provider}
            </span>
            <span className="badge badge-gray">⏱ {render.duration}s</span>
            {render.music_mode === "none" ? (
              <span className="badge badge-gray">🔇 không nhạc nền</span>
            ) : (
              <span className="badge badge-teal">
                🎵 {render.music_mode === "ai_bed" ? "nhạc AI" : "nhạc tải lên"} · ducking {render.audio_path ? "bật" : "…"}
              </span>
            )}
          </div>
          <audio controls src={render.audio_path ?? render.voice_path ?? undefined} style={{ width: "100%" }} />
          {render.audio_path && (
            <div className="hint" style={{ marginTop: 6 }}>Bản nghe trên là voice + nhạc đã phối ducking.</div>
          )}
          <div className="row" style={{ gap: 10, marginTop: 12 }}>
            {render.srt_path && <a className="btn btn-ghost btn-sm" href={render.srt_path} download>⬇ Phụ đề .SRT</a>}
            {render.vtt_path && <a className="btn btn-ghost btn-sm" href={render.vtt_path} download>⬇ .VTT</a>}
          </div>
        </div>
      )}

      {/* Bản nháp + kiểm định */}
      {previewReady && (
        <div className="card card-pad">
          <div className="row between" style={{ marginBottom: 14 }}>
            <div className="section-title" style={{ margin: 0 }}>Bản nháp · Gate 4</div>
            {quality && (
              <span className={`badge ${qaPassed ? "badge-green" : "badge-amber"}`}>
                Điểm chất lượng {quality.overall_score}/100 · {qaPassed ? "đạt" : "cần lưu ý"}
              </span>
            )}
          </div>
          <div className="grid grid-2" style={{ alignItems: "start" }}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              controls
              src={render!.preview_path!}
              style={{ width: "100%", borderRadius: 12, background: "#000", maxHeight: 460 }}
            />
            <div>
              {quality && <QualityCard q={quality} />}
              {status === "QUALITY_CHECK" && !finalReady && (
                <button
                  className="btn btn-primary"
                  style={{ marginTop: 16, width: "100%" }}
                  disabled={busy}
                  onClick={() => post(`/api/projects/${projectId}/render-final`)}
                >
                  {busy ? <span className="spin" /> : null}
                  Render bản cuối 1080×1920
                </button>
              )}
              {status === "RENDERING_FINAL" && (
                <div className="row muted" style={{ marginTop: 16 }}><span className="spin" /> Đang render bản cuối…</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video hoàn chỉnh */}
      {finalReady && (
        <div className="card card-pad" style={{ borderColor: "var(--teal-400)", background: "var(--teal-50)" }}>
          <div className="row between" style={{ marginBottom: 14 }}>
            <div className="section-title" style={{ margin: 0, color: "var(--teal-700)" }}>🎬 Video hoàn chỉnh</div>
            <span className="badge badge-green"><span className="dot" />Hoàn thành</span>
          </div>
          <div className="grid grid-2" style={{ alignItems: "start" }}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              controls
              src={render!.final_path!}
              style={{ width: "100%", borderRadius: 12, background: "#000", maxHeight: 500 }}
            />
            <div className="stack" style={{ gap: 12 }}>
              <div className="muted" style={{ fontSize: 13.5 }}>
                Bản cuối 9:16, 1080×1920, có voice + phụ đề burn sẵn. Tải về để đăng lên TikTok/Reels/Shorts.
              </div>
              <a className="btn btn-primary" href={render!.final_path!} download style={{ justifyContent: "center" }}>
                ⬇ Tải MP4 hoàn chỉnh
              </a>
              {render!.srt_path && (
                <a className="btn btn-ghost btn-sm" href={render!.srt_path} download style={{ justifyContent: "center" }}>
                  ⬇ Tải phụ đề .SRT
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Variant Manager + A/B — hiện khi bản gốc đã có video cuối */}
      {finalReady && <VariantManager projectId={projectId} planning={planning} onReload={onReload} />}
    </div>
  );
}

function QualityCard({ q }: { q: QualityReport }) {
  return (
    <div>
      <div className="row" style={{ alignItems: "baseline", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 34, fontWeight: 800, color: q.overall_score >= 85 ? "var(--green)" : "var(--amber)" }}>
          {q.overall_score}
        </span>
        <span className="muted">/ 100 điểm tổng</span>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        {QMETRICS.map((m) => {
          const v = q[m.key] as number;
          return (
            <div key={m.key} className="row" style={{ gap: 10 }}>
              <span style={{ width: 150, fontSize: 12.5, color: "var(--ink-500)" }}>{m.label}</span>
              <div className="progress" style={{ flex: 1 }}>
                <span style={{ width: `${v}%`, background: v >= 70 ? undefined : "var(--amber)" }} />
              </div>
              <span style={{ width: 34, textAlign: "right", fontSize: 12.5, fontWeight: 600 }}>{Math.round(v)}</span>
            </div>
          );
        })}
      </div>
      {q.issues.length > 0 && (
        <div className="stack" style={{ gap: 6, marginTop: 12 }}>
          {q.issues.map((it, i) => (
            <div key={i} className="row" style={{ gap: 8, fontSize: 12.5 }}>
              <span className={`badge ${it.severity === "error" ? "badge-red" : "badge-amber"}`} style={{ fontSize: 10.5 }}>
                {it.severity}
              </span>
              <span className="muted">{it.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
