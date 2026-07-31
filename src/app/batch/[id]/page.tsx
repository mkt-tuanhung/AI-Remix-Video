"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import type { Batch, Project, RenderOutput } from "@/lib/types";

interface BatchData {
  batch: Batch;
  projects: Project[];
  renders: Record<string, RenderOutput | null>;
}

export default function BatchDetail({ params }: { params: { id: string } }) {
  const [data, setData] = useState<BatchData | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/batches/${params.id}`, { cache: "no-store" });
    if (r.ok) setData(await r.json());
  }, [params.id]);

  useEffect(() => {
    let stopped = false;
    async function tick() {
      await fetch("/api/worker/tick", { method: "POST" }).catch(() => {});
      if (!stopped) await load();
    }
    tick();
    pollRef.current = setInterval(tick, 3000);
    return () => { stopped = true; if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  const projects = data?.projects ?? [];
  const done = projects.filter((p) => p.status === "COMPLETED").length;
  const failed = projects.filter((p) => p.status === "FAILED").length;
  const pct = projects.length ? Math.round((done / projects.length) * 100) : 0;

  return (
    <>
      <div className="topbar">
        <div className="row" style={{ gap: 14 }}>
          <Link href="/" className="muted" style={{ fontSize: 20 }}>←</Link>
          <h1>Batch · {projects.length} video</h1>
          {data && (data.batch.status === "completed"
            ? <span className="badge badge-green"><span className="dot" />Hoàn tất</span>
            : <span className="badge badge-teal"><span className="dot dot-pulse" />Đang xử lý</span>)}
        </div>
        <span className="muted" style={{ fontSize: 13 }}>{done}/{projects.length} xong · {pct}%{failed ? ` · ${failed} lỗi` : ""}</span>
      </div>

      <div className="content">
        <div className="progress" style={{ marginBottom: 22 }}><span style={{ width: `${pct}%` }} /></div>

        {!data ? (
          <div className="row muted"><span className="spin" /> Đang tải…</div>
        ) : (
          <div className="keyframe-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
            {projects.map((p) => {
              const r = data.renders[p.id];
              return (
                <div key={p.id} className="card card-pad" style={{ padding: 14 }}>
                  <div style={{ borderRadius: 8, overflow: "hidden", background: "#000", aspectRatio: "9/16", marginBottom: 10, display: "grid", placeItems: "center" }}>
                    {r?.final_path ? (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video src={r.final_path} controls style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : p.status === "FAILED" ? (
                      <span style={{ color: "var(--red)", fontSize: 24 }}>✕</span>
                    ) : (
                      <span className="spin" />
                    )}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <Link href={`/projects/${p.id}`} style={{ color: "var(--teal-700)" }}>{p.title}</Link>
                  </div>
                  <div className="row between">
                    <StatusBadge status={p.status} />
                    {r?.final_path && <a className="btn btn-ghost btn-sm" href={r.final_path} download>⬇</a>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
