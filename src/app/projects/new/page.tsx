"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const GOALS = [
  { v: "remix", l: "Kể lại hấp dẫn hơn" },
  { v: "summarize", l: "Tóm tắt" },
  { v: "expand", l: "Mở rộng" },
  { v: "explainer", l: "Video giải thích" },
  { v: "news", l: "Tin tức" },
  { v: "story", l: "Kể chuyện" },
  { v: "review", l: "Review" },
  { v: "sales", l: "Bán hàng" },
  { v: "education", l: "Giáo dục" },
];

const PLATFORMS = [
  { v: "tiktok", l: "TikTok" },
  { v: "instagram_reels", l: "Instagram Reels" },
  { v: "youtube_shorts", l: "YouTube Shorts" },
  { v: "facebook_reels", l: "Facebook Reels" },
];

const DURATIONS = [15, 30, 45, 60, 90];
const RATIOS = ["9:16", "1:1", "4:5", "16:9"];

export default function NewProject() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [projectId, setProjectId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("remix");
  const [platforms, setPlatforms] = useState<string[]>(["tiktok"]);
  const [duration, setDuration] = useState(60);
  const [ratio, setRatio] = useState("9:16");
  const [music, setMusic] = useState<"ai_bed" | "none">("ai_bed");
  const [rights, setRights] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function togglePlatform(v: string) {
    setPlatforms((prev) => (prev.includes(v) ? prev.filter((p) => p !== v) : [...prev, v]));
  }

  async function createProject() {
    setError(null);
    if (!title.trim()) return setError("Hãy đặt tên cho dự án.");
    if (!platforms.length) return setError("Chọn ít nhất một nền tảng.");
    if (!rights) return setError("Bạn cần xác nhận có quyền sử dụng video nguồn.");
    setBusy(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          goal,
          target_platforms: platforms,
          target_duration_seconds: duration,
          aspect_ratio: ratio,
          music_mode: music,
          rights_confirmed: rights,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tạo được dự án");
      setProjectId(data.project.id);
      setStep(2);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadAndAnalyze() {
    if (!projectId || !file) return setError("Chọn file video trước.");
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch(`/api/projects/${projectId}/source-video`, { method: "POST", body: fd });
      const upData = await up.json();
      if (!up.ok) throw new Error(upData.error || "Tải video thất bại");

      const an = await fetch(`/api/projects/${projectId}/analyze`, { method: "POST" });
      const anData = await an.json();
      if (!an.ok) throw new Error(anData.error || "Không khởi động được phân tích");

      router.push(`/projects/${projectId}`);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <h1>Tạo dự án mới</h1>
        <div className="row muted" style={{ fontSize: 13 }}>
          Bước {step}/2 · {step === 1 ? "Thông tin" : "Tải video"}
        </div>
      </div>

      <div className="content" style={{ maxWidth: 760 }}>
        {error && (
          <div className="banner warn" style={{ marginBottom: 20 }}>⚠️ {error}</div>
        )}

        {step === 1 && (
          <div className="card card-pad">
            <div className="field">
              <label className="label">Tên dự án</label>
              <input
                className="input"
                placeholder="VD: Remix video mẹo làm việc"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="field">
              <label className="label">Mục tiêu nội dung</label>
              <select className="select" value={goal} onChange={(e) => setGoal(e.target.value)}>
                {GOALS.map((g) => (
                  <option key={g.v} value={g.v}>{g.l}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="label">Nền tảng xuất bản</label>
              <div className="chip-row">
                {PLATFORMS.map((p) => (
                  <div
                    key={p.v}
                    className={`chip ${platforms.includes(p.v) ? "selected" : ""}`}
                    onClick={() => togglePlatform(p.v)}
                  >
                    {p.l}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-2">
              <div className="field">
                <label className="label">Thời lượng mục tiêu</label>
                <div className="chip-row">
                  {DURATIONS.map((d) => (
                    <div key={d} className={`chip ${duration === d ? "selected" : ""}`} onClick={() => setDuration(d)}>
                      {d}s
                    </div>
                  ))}
                </div>
              </div>
              <div className="field">
                <label className="label">Tỷ lệ khung hình</label>
                <div className="chip-row">
                  {RATIOS.map((r) => (
                    <div key={r} className={`chip ${ratio === r ? "selected" : ""}`} onClick={() => setRatio(r)}>
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="field">
              <label className="label">Nhạc nền</label>
              <div className="chip-row">
                <div className={`chip ${music === "ai_bed" ? "selected" : ""}`} onClick={() => setMusic("ai_bed")}>
                  🎵 AI tự phối (có music ducking)
                </div>
                <div className={`chip ${music === "none" ? "selected" : ""}`} onClick={() => setMusic("none")}>
                  🔇 Không nhạc
                </div>
              </div>
              <div className="hint">Nhạc nền tự động hạ xuống khi có lời thoại (sidechain ducking).</div>
            </div>

            <hr className="divider" />

            <label className="row" style={{ gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={rights}
                onChange={(e) => setRights(e.target.checked)}
                style={{ marginTop: 3, width: 16, height: 16, accentColor: "var(--teal-600)" }}
              />
              <span style={{ fontSize: 13.5, color: "var(--ink-700)" }}>
                Tôi xác nhận <strong>có quyền sử dụng</strong> video nguồn sẽ tải lên. Hệ thống chỉ dùng
                video làm nguyên liệu biên tập, không nhằm tải/đăng lại (đặc tả mục 23).
              </span>
            </label>

            <div className="row between" style={{ marginTop: 24 }}>
              <span />
              <button className="btn btn-primary" disabled={busy} onClick={createProject}>
                {busy ? <span className="spin" /> : null}
                Tiếp tục
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="card card-pad">
            <div className="field">
              <label className="label">Video nguồn</label>
              <input
                className="input"
                type="file"
                accept="video/mp4,video/quicktime,video/x-m4v,video/webm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <div className="hint">MP4, MOV, M4V hoặc WebM · tối đa 5 phút (đặc tả 5.1).</div>
            </div>

            {file && (
              <div className="banner">
                🎞️ {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
              </div>
            )}

            <div className="hint" style={{ marginBottom: 18 }}>
              Sau khi tải, hệ thống sẽ chạy: <strong>Tiếp nhận → Transcript → Phân tích hình ảnh → Hiểu nội dung</strong>.
              Thiếu API key thì các bước tự chạy ở chế độ mock.
            </div>

            <div className="row between">
              <button className="btn btn-ghost" onClick={() => setStep(1)} disabled={busy}>← Quay lại</button>
              <button className="btn btn-primary" disabled={busy || !file} onClick={uploadAndAnalyze}>
                {busy ? <span className="spin" /> : null}
                Tải & bắt đầu phân tích
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
