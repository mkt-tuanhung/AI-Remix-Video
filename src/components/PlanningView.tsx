"use client";

import { useEffect, useState } from "react";
import { ProductionView } from "./ProductionView";
import type { PlanningBundle } from "@/lib/services";
import type { Hook, ProjectStatus, Scene } from "@/lib/types";

function hookOverall(h: Hook): number {
  const s = h.scores;
  return (s.clarity + s.curiosity + s.relevance + s.retention_3s + s.honesty) / 5;
}

function estSeconds(text: string): number {
  const w = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round((w / 2.6) * 10) / 10;
}

const ASSET_LABEL: Record<string, { l: string; cls: string }> = {
  source_clip: { l: "cảnh nguồn", cls: "badge-teal" },
  stock_video: { l: "video stock", cls: "badge-blue" },
  image: { l: "ảnh", cls: "badge-gray" },
  ai_visual: { l: "AI tạo", cls: "badge-amber" },
  motion_graphic: { l: "đồ hoạ động", cls: "badge-green" },
};

const HOOK_TYPE: Record<string, string> = {
  question: "Câu hỏi",
  surprise: "Bất ngờ",
  pain: "Nỗi đau",
  result: "Kết quả",
  climax: "Cao trào",
};

export function PlanningView({
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
  const { strategies, hooks, variant, scenes, assets } = planning;
  const [script, setScript] = useState(variant?.script ?? "");
  const [cta, setCta] = useState(variant?.cta ?? "");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  // Đồng bộ khi dữ liệu tải lại (nếu người dùng chưa sửa dở).
  useEffect(() => {
    if (!dirty && variant) {
      setScript(variant.script);
      setCta(variant.cta);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant?.script, variant?.cta]);

  if (!variant) {
    // Chưa có kịch bản: chỉ hiện khi đã qua phân tích.
    if (status === "PLANNING_CONTENT") {
      return (
        <div className="card card-pad" style={{ marginTop: 22 }}>
          <div className="row muted"><span className="spin" /> Đang lên chiến lược và viết lại kịch bản…</div>
        </div>
      );
    }
    return null;
  }

  const estimated = estSeconds(`${script} ${cta}`);
  const target = variant.target_duration_seconds;
  const durOk = Math.abs(estimated - target) <= target * 0.25;
  const canApprove = status === "WAITING_FOR_SCRIPT_APPROVAL";
  const storyboardReady = scenes.length > 0;

  async function saveVariant(patch: Record<string, string>) {
    await fetch(`/api/variants/${variant!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await onReload();
  }

  async function chooseHook(h: Hook) {
    setBusy(true);
    try {
      await saveVariant({ hook: h.text });
    } finally {
      setBusy(false);
    }
  }

  async function saveScript() {
    setBusy(true);
    try {
      await saveVariant({ script, cta });
      setDirty(false);
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    setBusy(true);
    try {
      if (dirty) await saveVariant({ script, cta });
      await fetch(`/api/projects/${projectId}/approve-script`, { method: "POST" });
      await onReload();
      setDirty(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 22, marginTop: 22 }}>
      {/* Chiến lược */}
      {strategies.length > 0 && (
        <div className="card card-pad">
          <div className="section-title">Chiến lược nội dung</div>
          <div className="grid grid-3">
            {strategies.map((s) => {
              const active = s.angle === variant.content_angle;
              return (
                <div
                  key={s.id}
                  className="card card-pad"
                  style={{
                    padding: 16,
                    borderColor: active ? "var(--teal-400)" : "var(--line)",
                    background: active ? "var(--teal-50)" : "var(--surface)",
                  }}
                >
                  <div className="row between" style={{ marginBottom: 8 }}>
                    <span style={{ fontWeight: 650, fontSize: 14 }}>{s.angle}</span>
                    {active && <span className="badge badge-teal" style={{ fontSize: 10.5 }}>đang dùng</span>}
                  </div>
                  <div className="stack" style={{ gap: 4, fontSize: 12.5 }}>
                    <span className="muted">👥 {s.audience}</span>
                    <span className="muted">💫 {s.emotion} · nhịp {s.pacing}</span>
                    <span className="muted">⏱ {s.recommended_duration_seconds}s</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hooks */}
      {hooks.length > 0 && (
        <div className="card card-pad">
          <div className="section-title">Phương án hook · chọn 1</div>
          <div className="stack" style={{ gap: 10 }}>
            {hooks.map((h) => {
              const selected = h.text === variant.hook;
              const overall = Math.round(hookOverall(h) * 100);
              return (
                <div
                  key={h.id}
                  onClick={() => !busy && chooseHook(h)}
                  className="row"
                  style={{
                    gap: 12,
                    alignItems: "flex-start",
                    padding: 12,
                    borderRadius: 10,
                    cursor: "pointer",
                    border: `1px solid ${selected ? "var(--teal-400)" : "var(--line)"}`,
                    background: selected ? "var(--teal-50)" : "var(--surface)",
                  }}
                >
                  <span
                    style={{
                      width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                      border: `2px solid ${selected ? "var(--teal-600)" : "var(--line-strong)"}`,
                      background: selected ? "var(--teal-600)" : "transparent",
                      boxShadow: selected ? "inset 0 0 0 3px #fff" : "none",
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, marginBottom: 6 }}>{h.text}</div>
                    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                      <span className="badge badge-gray" style={{ fontSize: 10.5 }}>{HOOK_TYPE[h.type] ?? h.type}</span>
                      <ScoreChip label="giữ chân 3s" v={h.scores.retention_3s} />
                      <ScoreChip label="tò mò" v={h.scores.curiosity} />
                      <ScoreChip label="trung thực" v={h.scores.honesty} />
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 750, fontSize: 18, color: "var(--teal-700)" }}>{overall}</div>
                    <div className="muted" style={{ fontSize: 10.5 }}>điểm</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Kịch bản — Gate 2 */}
      <div className="card card-pad">
        <div className="row between" style={{ marginBottom: 12 }}>
          <div className="section-title" style={{ margin: 0 }}>Kịch bản mới · Gate 2</div>
          <span className={`badge ${durOk ? "badge-green" : "badge-amber"}`}>
            ~{estimated}s / mục tiêu {target}s
          </span>
        </div>
        <textarea
          className="textarea"
          value={script}
          onChange={(e) => { setScript(e.target.value); setDirty(true); }}
          style={{ minHeight: 160 }}
        />
        <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
          <label className="label">CTA</label>
          <input className="input" value={cta} onChange={(e) => { setCta(e.target.value); setDirty(true); }} />
        </div>
        <div className="hint" style={{ marginTop: 8 }}>
          Kịch bản giữ đúng dữ kiện gốc, chỉ đổi cách kể. Sửa tự do rồi duyệt để dựng storyboard.
        </div>
        <div className="row" style={{ gap: 10, marginTop: 14 }}>
          <button className="btn btn-ghost btn-sm" disabled={busy || !dirty} onClick={saveScript}>Lưu chỉnh sửa</button>
          <button className="btn btn-primary btn-sm" disabled={busy || !canApprove} onClick={approve}>
            {busy ? <span className="spin" /> : null}
            {canApprove ? "Duyệt & dựng storyboard" : "Đã duyệt kịch bản"}
          </button>
        </div>
      </div>

      {/* Storyboard */}
      {storyboardReady && (
        <div className="card card-pad">
          <div className="row between" style={{ marginBottom: 14 }}>
            <div className="section-title" style={{ margin: 0 }}>Storyboard · {scenes.length} cảnh</div>
            <span className="muted" style={{ fontSize: 12.5 }}>Điểm khớp cảnh–lời trung bình {avgMatch(scenes)}%</span>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            {scenes.map((sc) => {
              const at = ASSET_LABEL[sc.asset_type] ?? ASSET_LABEL.image;
              const asset = sc.asset_id ? assets[sc.asset_id] : null;
              const match = sc.scene_voice_match_score != null ? Math.round(sc.scene_voice_match_score * 100) : null;
              return (
                <div key={sc.id} className="list-item row" style={{ gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 34, textAlign: "center", flexShrink: 0 }}>
                    <div style={{ fontWeight: 750, color: "var(--teal-700)" }}>{sc.order + 1}</div>
                    <div className="muted" style={{ fontSize: 10 }}>{sc.start_time}s</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14 }}>{sc.narration}</div>
                    <div className="row" style={{ gap: 7, flexWrap: "wrap", marginTop: 7 }}>
                      <span className={`badge ${at.cls}`} style={{ fontSize: 10.5 }}>{at.l}</span>
                      {sc.on_screen_text && <span className="badge badge-gray" style={{ fontSize: 10.5 }}>“{sc.on_screen_text}”</span>}
                      <span className="badge badge-gray" style={{ fontSize: 10.5 }}>fx: {sc.effect}</span>
                      {match != null && (
                        <span className={`badge ${match >= 70 ? "badge-green" : "badge-amber"}`} style={{ fontSize: 10.5 }}>
                          khớp {match}%
                        </span>
                      )}
                    </div>
                    {asset && (
                      <div className="muted" style={{ fontSize: 11.5, marginTop: 5 }}>
                        📎 {asset.provider} · {asset.license}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Giai đoạn sản xuất: voice → phụ đề → render → kiểm định → bản cuối */}
      <ProductionView projectId={projectId} status={status} planning={planning} onReload={onReload} />
    </div>
  );
}

function ScoreChip({ label, v }: { label: string; v: number }) {
  const pct = Math.round(v * 100);
  return (
    <span className="badge badge-gray" style={{ fontSize: 10.5 }}>
      {label} {pct}
    </span>
  );
}

function avgMatch(scenes: Scene[]): number {
  const vals = scenes.map((s) => s.scene_voice_match_score ?? 0);
  if (!vals.length) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100);
}
