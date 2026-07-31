"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { PlanningView } from "./PlanningView";
import type { Job, Project, SourceAnalysis, SourceVideo } from "@/lib/types";
import type { PlanningBundle } from "@/lib/services";

interface Bundle {
  project: Project;
  video: SourceVideo | null;
  analysis: SourceAnalysis | null;
  jobs: Job[];
  planning: PlanningBundle;
}

const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

const STEP_LABEL: Record<string, string> = {
  INGEST: "Tiếp nhận video",
  TRANSCRIBE: "Chuyển giọng nói → văn bản",
  VISION_ANALYSIS: "Phân tích hình ảnh",
  CONTENT_ANALYSIS: "Hiểu nội dung & dữ kiện",
  SCRIPT_GENERATION: "Chiến lược · hook · kịch bản",
  STORYBOARD: "Dựng storyboard",
  ASSET_SEARCH: "Tìm & gán tài nguyên",
  VOICE_GENERATION: "Tạo voice AI",
  MUSIC_MIX: "Phối nhạc + ducking",
  CAPTION_GENERATION: "Tạo phụ đề",
  PREVIEW_RENDER: "Render bản nháp",
  QUALITY_CHECK: "Kiểm định chất lượng",
  FINAL_RENDER: "Render bản cuối",
};

const FACT_KIND: Record<string, { cls: string; l: string }> = {
  confirmed: { cls: "badge-green", l: "Dữ kiện" },
  opinion: { cls: "badge-blue", l: "Nhận định" },
  inferred: { cls: "badge-gray", l: "Suy luận" },
  uncertain: { cls: "badge-amber", l: "Chưa chắc" },
  needs_check: { cls: "badge-red", l: "Cần kiểm chứng" },
};

export function ProjectView({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Bundle | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [approving, setApproving] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
    if (!res.ok) return;
    const bundle: Bundle = await res.json();
    setData(bundle);
    if (!dirty && bundle.analysis) setTranscript(bundle.analysis.transcript);
    return bundle;
  }, [projectId, dirty]);

  useEffect(() => {
    let stopped = false;
    async function tick() {
      // Đảm bảo worker chạy, rồi tải lại dữ liệu.
      await fetch("/api/worker/tick", { method: "POST" }).catch(() => {});
      await load();
      // Luôn poll (nhẹ) để bắt kịp job A/B tạo sau khi dự án đã COMPLETED.
      if (stopped && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    tick();
    pollRef.current = setInterval(tick, 2500);
    return () => {
      stopped = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function saveTranscript(approve: boolean) {
    setApproving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/analysis`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, approved: approve }),
      });
      if (res.ok) {
        setDirty(false);
        await load();
      }
    } finally {
      setApproving(false);
    }
  }

  if (!data) {
    return (
      <>
        <div className="topbar"><h1>Đang tải…</h1></div>
        <div className="content"><div className="row muted"><span className="spin" /> Đang tải dự án</div></div>
      </>
    );
  }

  const { project, video, analysis, jobs } = data;
  const done = jobs.filter((j) => j.status === "completed").length;
  const active = jobs.some((j) => j.status === "pending" || j.status === "running");
  const overallPct = jobs.length ? Math.round((done / jobs.length) * 100) : 0;
  const waitingApproval = project.status === "WAITING_FOR_TRANSCRIPT_APPROVAL" || project.status === "PLANNING_CONTENT";

  return (
    <>
      <div className="topbar">
        <div className="row" style={{ gap: 14 }}>
          <Link href="/" className="muted" style={{ fontSize: 20 }}>←</Link>
          <h1>{project.title}</h1>
          <StatusBadge status={project.status} />
        </div>
        <div className="muted" style={{ fontSize: 13 }}>
          {project.goal} · {project.target_duration_seconds}s · {project.aspect_ratio}
        </div>
      </div>

      <div className="content">
        {/* Pipeline progress */}
        <div className="card card-pad" style={{ marginBottom: 22 }}>
          <div className="row between" style={{ marginBottom: 14 }}>
            <div className="section-title" style={{ margin: 0 }}>
              Dây chuyền phân tích {active && <span className="spin" style={{ marginLeft: 8 }} />}
            </div>
            <span className="muted" style={{ fontSize: 13 }}>{done}/{jobs.length} bước · {overallPct}%</span>
          </div>
          <div className="progress" style={{ marginBottom: 16 }}><span style={{ width: `${overallPct}%` }} /></div>
          <div>
            {jobs.map((j) => (
              <div className="job-line" key={j.id}>
                <span className="job-step">{STEP_LABEL[j.step] ?? j.step}</span>
                <JobBadge job={j} />
                <span className="job-msg">{j.message}</span>
                {j.status === "running" && (
                  <div className="progress" style={{ width: 90 }}><span style={{ width: `${Math.round(j.progress * 100)}%` }} /></div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-2" style={{ alignItems: "start" }}>
          {/* Left: source video + transcript */}
          <div className="stack" style={{ gap: 22 }}>
            <div className="card card-pad">
              <div className="section-title">Video nguồn</div>
              {video ? (
                <>
                  <video
                    src={video.storage_path}
                    poster={video.thumbnail_path ?? undefined}
                    controls
                    style={{ width: "100%", borderRadius: 10, background: "#000", maxHeight: 320 }}
                  />
                  <div className="row" style={{ gap: 16, marginTop: 12, flexWrap: "wrap", fontSize: 12.5 }}>
                    <span className="muted">{video.filename}</span>
                    {video.duration_seconds != null && <span className="muted">⏱ {video.duration_seconds}s</span>}
                    {video.width && <span className="muted">{video.width}×{video.height}</span>}
                    <span className="muted">{(video.size_bytes / 1024 / 1024).toFixed(1)} MB</span>
                    <span className={`badge ${video.has_audio ? "badge-teal" : "badge-gray"}`} style={{ padding: "1px 8px", fontSize: 11 }}>
                      {video.has_audio ? "có tiếng" : "không tiếng"}
                    </span>
                  </div>
                </>
              ) : (
                <div className="muted">Chưa có video.</div>
              )}
            </div>

            <div className="card card-pad">
              <div className="row between" style={{ marginBottom: 12 }}>
                <div className="section-title" style={{ margin: 0 }}>Transcript · Gate 1</div>
                {analysis?.transcript_approved && <span className="badge badge-green"><span className="dot" />Đã duyệt</span>}
              </div>
              {analysis?.transcript ? (
                <>
                  <textarea
                    className="textarea"
                    value={transcript}
                    onChange={(e) => { setTranscript(e.target.value); setDirty(true); }}
                    style={{ minHeight: 180 }}
                  />
                  <div className="hint">Sửa tên riêng, số liệu và dấu câu trước khi viết lại kịch bản (đặc tả 8.3, 13).</div>
                  <div className="row" style={{ gap: 10, marginTop: 14 }}>
                    <button className="btn btn-ghost btn-sm" disabled={approving || !dirty} onClick={() => saveTranscript(false)}>
                      Lưu chỉnh sửa
                    </button>
                    <button className="btn btn-primary btn-sm" disabled={approving} onClick={() => saveTranscript(true)}>
                      {approving ? <span className="spin" /> : null}
                      Duyệt & sang bước kịch bản
                    </button>
                  </div>
                </>
              ) : (
                <div className="muted row"><span className="spin" /> Đang tạo transcript…</div>
              )}
            </div>
          </div>

          {/* Right: understanding */}
          <div className="stack" style={{ gap: 22 }}>
            <div className="card card-pad">
              <div className="section-title">Hiểu nội dung</div>
              {analysis?.main_topic ? (
                <>
                  <div className="stack" style={{ gap: 12 }}>
                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Chủ đề chính</div>
                      <div style={{ fontWeight: 600 }}>{analysis.main_topic}</div>
                    </div>
                    {analysis.source_hook && (
                      <div>
                        <div className="muted" style={{ fontSize: 12 }}>Hook bản gốc</div>
                        <div>{analysis.source_hook}</div>
                      </div>
                    )}
                    {analysis.source_cta && (
                      <div>
                        <div className="muted" style={{ fontSize: 12 }}>CTA bản gốc</div>
                        <div>{analysis.source_cta}</div>
                      </div>
                    )}
                  </div>
                  {analysis.entities.length > 0 && (
                    <>
                      <hr className="divider" />
                      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Thực thể</div>
                      <div className="chip-row">
                        {analysis.entities.map((e, i) => (
                          <span key={i} className="badge badge-gray" style={{ fontWeight: 500 }}>
                            {e.name} <span className="muted" style={{ fontSize: 11 }}>· {e.type}</span>
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="muted row"><span className="spin" /> Đang phân tích nội dung…</div>
              )}
            </div>

            {analysis && analysis.facts.length > 0 && (
              <div className="card card-pad">
                <div className="section-title">Bản đồ dữ kiện</div>
                <div className="stack" style={{ gap: 0 }}>
                  {analysis.facts.map((f, i) => {
                    const k = FACT_KIND[f.kind] ?? FACT_KIND.inferred;
                    return (
                      <div className="list-item row" key={i} style={{ gap: 10, alignItems: "flex-start" }}>
                        <span className={`badge ${k.cls}`} style={{ flexShrink: 0 }}>{k.l}</span>
                        <span style={{ fontSize: 13.5 }}>{f.text}</span>
                        {f.locked && <span title="Không được tự ý đổi" style={{ marginLeft: "auto" }}>🔒</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {analysis && (analysis.uncertain_claims.length > 0 || analysis.conflicts.length > 0) && (
              <div className="card card-pad" style={{ borderColor: "#fde68a", background: "#fffdf7" }}>
                <div className="section-title" style={{ color: "var(--amber)" }}>⚠ Cần kiểm tra</div>
                {analysis.conflicts.map((c, i) => (
                  <div className="list-item" key={`c${i}`} style={{ fontSize: 13.5 }}>Mâu thuẫn lời–hình: {c}</div>
                ))}
                {analysis.uncertain_claims.map((c, i) => (
                  <div className="list-item" key={`u${i}`} style={{ fontSize: 13.5 }}>Chưa chắc chắn: {c}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Shots / keyframes */}
        <div className="card card-pad" style={{ marginTop: 22 }}>
          <div className="section-title">Cảnh quay (shots)</div>
          {analysis && analysis.shots.length > 0 ? (
            <div className="keyframe-grid">
              {analysis.shots.map((s) => (
                <div key={s.shot_id}>
                  <div className="keyframe">
                    {s.keyframe_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.keyframe_path} alt={s.description} />
                    ) : (
                      <div className="keyframe-ph">{s.description || s.shot_id}</div>
                    )}
                    <span className="keyframe-meta badge badge-gray" style={{ padding: "1px 7px", fontSize: 10.5 }}>
                      {s.start_time}–{s.end_time}s
                    </span>
                  </div>
                  <div style={{ fontSize: 12, marginTop: 6, color: "var(--ink-500)" }}>{s.description}</div>
                  <div className="row" style={{ gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                    <span className="badge badge-gray" style={{ padding: "0 7px", fontSize: 10.5 }}>Q {Math.round(s.quality_score * 100)}%</span>
                    {s.logo_detected && <span className="badge badge-amber" style={{ padding: "0 7px", fontSize: 10.5 }}>logo</span>}
                    {s.reuse_eligible
                      ? <span className="badge badge-green" style={{ padding: "0 7px", fontSize: 10.5 }}>tái dùng</span>
                      : <span className="badge badge-red" style={{ padding: "0 7px", fontSize: 10.5 }}>bỏ</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted row"><span className="spin" /> Đang tách cảnh…</div>
          )}
        </div>

        {project.status === "WAITING_FOR_TRANSCRIPT_APPROVAL" && (
          <div className="banner" style={{ marginTop: 22 }}>
            👇 Duyệt transcript ở trên để hệ thống sinh chiến lược, hook và viết lại kịch bản.
          </div>
        )}

        <PlanningView
          projectId={projectId}
          status={project.status}
          planning={data.planning}
          onReload={load}
        />
      </div>
    </>
  );
}

function JobBadge({ job }: { job: Job }) {
  const map: Record<string, string> = {
    pending: "badge-gray",
    running: "badge-teal",
    completed: "badge-green",
    failed: "badge-red",
    cancelled: "badge-gray",
  };
  const label: Record<string, string> = {
    pending: "chờ",
    running: "đang chạy",
    completed: "xong",
    failed: "lỗi",
    cancelled: "huỷ",
  };
  return (
    <span className={`badge ${map[job.status]}`} style={{ flexShrink: 0 }}>
      {job.status === "running" && <span className="dot dot-pulse" />}
      {label[job.status]}
    </span>
  );
}
