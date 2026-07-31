"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { ProductionView } from "./ProductionView";
import type { Job, Project, SourceVideo, SourceAnalysis } from "@/lib/types";
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
  STORY_SCRIPT: "Viết kịch bản",
  STORY_STORYBOARD: "Chia khung hình",
  IMAGE_GENERATION: "Sinh ảnh AI",
  VOICE_GENERATION: "Tạo voice AI",
  MUSIC_MIX: "Phối nhạc + ducking",
  CAPTION_GENERATION: "Tạo phụ đề",
  PREVIEW_RENDER: "Render bản nháp",
  QUALITY_CHECK: "Kiểm định chất lượng",
  FINAL_RENDER: "Render phim hoàn chỉnh",
};

const GENRE_LABEL: Record<string, string> = {
  "2d": "Hoạt hình 2D", "3d": "Hoạt hình 3D", epic: "Epic điện ảnh",
  papercut: "Xé giấy", handdrawn: "Vẽ tay", watercolor: "Màu nước", realistic: "Chân thực",
};

export function StoryView({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Bundle | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, [projectId]);

  useEffect(() => {
    let stopped = false;
    async function tick() {
      await fetch("/api/worker/tick", { method: "POST" }).catch(() => {});
      if (!stopped) await load();
    }
    tick();
    pollRef.current = setInterval(tick, 2500);
    return () => { stopped = true; if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  if (!data) {
    return (<><div className="topbar"><h1>Đang tải…</h1></div>
      <div className="content"><div className="row muted"><span className="spin" /> Đang tải phim</div></div></>);
  }

  const { project, jobs, planning } = data;
  const variant = planning.variant;
  const done = jobs.filter((j) => j.status === "completed").length;
  const active = jobs.some((j) => j.status === "pending" || j.status === "running");
  const pct = jobs.length ? Math.round((done / jobs.length) * 100) : 0;
  const scenes = planning.scenes;

  return (
    <>
      <div className="topbar">
        <div className="row" style={{ gap: 14 }}>
          <Link href="/" className="muted" style={{ fontSize: 20 }}>←</Link>
          <h1>🎬 {project.title}</h1>
          <StatusBadge status={project.status} />
        </div>
        <div className="muted" style={{ fontSize: 13 }}>
          Truyện → Phim · {GENRE_LABEL[project.genre ?? "2d"]} · {project.target_duration_seconds}s
        </div>
      </div>

      <div className="content">
        {/* Progress */}
        <div className="card card-pad" style={{ marginBottom: 22 }}>
          <div className="row between" style={{ marginBottom: 14 }}>
            <div className="section-title" style={{ margin: 0 }}>
              Dây chuyền sản xuất {active && <span className="spin" style={{ marginLeft: 8 }} />}
            </div>
            <span className="muted" style={{ fontSize: 13 }}>{done}/{jobs.length} bước · {pct}%</span>
          </div>
          <div className="progress" style={{ marginBottom: 16 }}><span style={{ width: `${pct}%` }} /></div>
          {jobs.map((j) => (
            <div className="job-line" key={j.id}>
              <span className="job-step">{STEP_LABEL[j.step] ?? j.step}</span>
              <JobBadge job={j} />
              <span className="job-msg">{j.message}</span>
            </div>
          ))}
        </div>

        {/* Script */}
        {variant?.script && (
          <div className="card card-pad" style={{ marginBottom: 22 }}>
            <div className="section-title">Kịch bản (lời kể)</div>
            <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{variant.script}</div>
          </div>
        )}

        {/* Storyboard — khung + ảnh AI */}
        {scenes.length > 0 && (
          <div className="card card-pad" style={{ marginBottom: 22 }}>
            <div className="section-title">Khung hình · {scenes.length}</div>
            <div className="keyframe-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
              {scenes.map((sc) => {
                const asset = sc.asset_id ? planning.assets[sc.asset_id] : null;
                return (
                  <div key={sc.id}>
                    <div style={{ borderRadius: 10, overflow: "hidden", background: "#0c2b28", aspectRatio: "9/16", display: "grid", placeItems: "center" }}>
                      {asset?.local_path ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={asset.local_path} alt={sc.narration} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span className="spin" />
                      )}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 6, color: "var(--ink-500)" }}>
                      <b>{sc.order + 1}.</b> {sc.narration}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Voice / nhạc / phim hoàn chỉnh (tái dùng ProductionView) */}
        <ProductionView projectId={projectId} status={project.status} planning={planning} onReload={load} />
      </div>
    </>
  );
}

function JobBadge({ job }: { job: Job }) {
  const map: Record<string, string> = { pending: "badge-gray", running: "badge-teal", completed: "badge-green", failed: "badge-red", cancelled: "badge-gray" };
  const label: Record<string, string> = { pending: "chờ", running: "đang chạy", completed: "xong", failed: "lỗi", cancelled: "huỷ" };
  return (
    <span className={`badge ${map[job.status]}`} style={{ flexShrink: 0 }}>
      {job.status === "running" && <span className="dot dot-pulse" />}{label[job.status]}
    </span>
  );
}
