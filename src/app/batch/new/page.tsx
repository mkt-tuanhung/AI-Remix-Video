"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const GOALS = [
  { v: "remix", l: "Kể lại hấp dẫn hơn" },
  { v: "summarize", l: "Tóm tắt" },
  { v: "explainer", l: "Giải thích" },
  { v: "news", l: "Tin tức" },
  { v: "review", l: "Review" },
  { v: "sales", l: "Bán hàng" },
  { v: "education", l: "Giáo dục" },
];
const PLATFORMS = [
  { v: "tiktok", l: "TikTok" },
  { v: "youtube_shorts", l: "YouTube Shorts" },
  { v: "instagram_reels", l: "Instagram Reels" },
  { v: "facebook_reels", l: "Facebook Reels" },
];
const DURATIONS = [15, 30, 45, 60, 90];

export default function BatchNew() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [goal, setGoal] = useState("remix");
  const [platform, setPlatform] = useState("tiktok");
  const [duration, setDuration] = useState(45);
  const [lang, setLang] = useState<"en" | "vi">("en");
  const [music, setMusic] = useState<"ai_bed" | "none">("ai_bed");
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!files.length) return setError("Chọn ít nhất 1 video.");
    if (!rights) return setError("Cần xác nhận quyền sử dụng các video nguồn.");
    setBusy(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      fd.append("goal", goal);
      fd.append("platform", platform);
      fd.append("duration", String(duration));
      fd.append("aspect_ratio", "9:16");
      fd.append("output_language", lang);
      fd.append("music_mode", music);
      fd.append("rights_confirmed", "true");
      const res = await fetch("/api/batches", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tạo batch thất bại");
      router.push(`/batch/${data.batch.id}`);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <>
      <div className="topbar"><h1>Xử lý hàng loạt</h1></div>
      <div className="content" style={{ maxWidth: 760 }}>
        {error && <div className="banner warn" style={{ marginBottom: 20 }}>⚠️ {error}</div>}
        <div className="card card-pad">
          <div className="field">
            <label className="label">Chọn nhiều video nguồn</label>
            <input
              className="input"
              type="file"
              multiple
              accept="video/mp4,video/quicktime,video/x-m4v,video/webm"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            <div className="hint">Mỗi video sẽ tự chạy trọn dây chuyền (auto-pilot) — không cần duyệt từng bước.</div>
          </div>

          {files.length > 0 && (
            <div className="banner" style={{ marginBottom: 18 }}>
              🎞️ Đã chọn {files.length} video · {(files.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB
            </div>
          )}

          <div className="grid grid-2">
            <div className="field">
              <label className="label">Mục tiêu</label>
              <select className="select" value={goal} onChange={(e) => setGoal(e.target.value)}>
                {GOALS.map((g) => <option key={g.v} value={g.v}>{g.l}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Nền tảng</label>
              <select className="select" value={platform} onChange={(e) => setPlatform(e.target.value)}>
                {PLATFORMS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label className="label">Thời lượng mục tiêu</label>
            <div className="chip-row">
              {DURATIONS.map((d) => (
                <div key={d} className={`chip ${duration === d ? "selected" : ""}`} onClick={() => setDuration(d)}>{d}s</div>
              ))}
            </div>
          </div>

          <div className="grid grid-2">
            <div className="field">
              <label className="label">Nhạc nền</label>
              <div className="chip-row">
                <div className={`chip ${music === "ai_bed" ? "selected" : ""}`} onClick={() => setMusic("ai_bed")}>🎵 AI tự phối</div>
                <div className={`chip ${music === "none" ? "selected" : ""}`} onClick={() => setMusic("none")}>🔇 Không nhạc</div>
              </div>
            </div>
            <div className="field">
              <label className="label">Ngôn ngữ đầu ra</label>
              <div className="chip-row">
                <div className={`chip ${lang === "en" ? "selected" : ""}`} onClick={() => setLang("en")}>🇬🇧 English</div>
                <div className={`chip ${lang === "vi" ? "selected" : ""}`} onClick={() => setLang("vi")}>🇻🇳 Tiếng Việt</div>
              </div>
            </div>
          </div>

          <hr className="divider" />
          <label className="row" style={{ gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
            <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)}
              style={{ marginTop: 3, width: 16, height: 16, accentColor: "var(--teal-600)" }} />
            <span style={{ fontSize: 13.5, color: "var(--ink-700)" }}>
              Tôi xác nhận có quyền sử dụng tất cả video nguồn tải lên trong batch này.
            </span>
          </label>

          <div className="row between" style={{ marginTop: 22 }}>
            <span className="hint" style={{ margin: 0 }}>Các video xử lý tuần tự, tự render bản cuối.</span>
            <button className="btn btn-primary" disabled={busy} onClick={submit}>
              {busy ? <span className="spin" /> : null} Chạy hàng loạt
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
