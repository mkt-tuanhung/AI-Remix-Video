"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const GENRES = [
  { v: "2d", l: "🎨 Hoạt hình 2D" },
  { v: "3d", l: "🧊 Hoạt hình 3D" },
  { v: "epic", l: "⚔️ Epic điện ảnh" },
  { v: "papercut", l: "✂️ Xé giấy" },
  { v: "handdrawn", l: "✏️ Vẽ tay" },
  { v: "watercolor", l: "🖌️ Màu nước" },
  { v: "realistic", l: "📷 Chân thực" },
];
const DURATIONS = [30, 45, 60, 90];

export default function StoryNew() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [genre, setGenre] = useState("2d");
  const [lang, setLang] = useState<"en" | "vi">("en");
  const [duration, setDuration] = useState(45);
  const [music, setMusic] = useState<"ai_bed" | "none">("ai_bed");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!story.trim()) return setErr("Hãy nhập nội dung/truyện.");
    setBusy(true);
    try {
      const res = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          story_text: story,
          genre,
          output_language: lang,
          target_duration_seconds: duration,
          aspect_ratio: "9:16",
          music_mode: music,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tạo được");
      router.push(`/projects/${data.project.id}`);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <>
      <div className="topbar"><h1>Tạo phim từ truyện</h1></div>
      <div className="content" style={{ maxWidth: 780 }}>
        {err && <div className="banner warn" style={{ marginBottom: 20 }}>⚠️ {err}</div>}
        <div className="card card-pad">
          <div className="field">
            <label className="label">Tên phim (tuỳ chọn)</label>
            <input className="input" placeholder="Để trống → AI tự đặt tên" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="field">
            <label className="label">Nội dung / truyện</label>
            <textarea
              className="textarea"
              style={{ minHeight: 160 }}
              placeholder="Dán truyện cổ tích, ý tưởng, hoặc chỉ vài câu tóm tắt — AI sẽ viết thành kịch bản phim."
              value={story}
              onChange={(e) => setStory(e.target.value)}
            />
            <div className="hint">Chỉ cần 1 nội dung ban đầu, hệ thống lo hết: kịch bản → khung hình → sinh ảnh AI → voice → nhạc → ghép phim.</div>
          </div>

          <div className="field">
            <label className="label">Thể loại hình ảnh</label>
            <div className="chip-row">
              {GENRES.map((g) => (
                <div key={g.v} className={`chip ${genre === g.v ? "selected" : ""}`} onClick={() => setGenre(g.v)}>{g.l}</div>
              ))}
            </div>
          </div>

          <div className="grid grid-2">
            <div className="field">
              <label className="label">Ngôn ngữ lời kể</label>
              <div className="chip-row">
                <div className={`chip ${lang === "en" ? "selected" : ""}`} onClick={() => setLang("en")}>🇬🇧 English</div>
                <div className={`chip ${lang === "vi" ? "selected" : ""}`} onClick={() => setLang("vi")}>🇻🇳 Tiếng Việt</div>
              </div>
            </div>
            <div className="field">
              <label className="label">Nhạc nền</label>
              <div className="chip-row">
                <div className={`chip ${music === "ai_bed" ? "selected" : ""}`} onClick={() => setMusic("ai_bed")}>🎵 AI tự phối</div>
                <div className={`chip ${music === "none" ? "selected" : ""}`} onClick={() => setMusic("none")}>🔇 Không</div>
              </div>
            </div>
          </div>

          <div className="field">
            <label className="label">Thời lượng</label>
            <div className="chip-row">
              {DURATIONS.map((d) => (
                <div key={d} className={`chip ${duration === d ? "selected" : ""}`} onClick={() => setDuration(d)}>{d}s</div>
              ))}
            </div>
          </div>

          <div className="banner" style={{ marginBottom: 16 }}>
            💰 Sinh ảnh AI ~$0.08/khung. Phim {Math.max(4, Math.round(duration / 7))}–{Math.min(10, Math.round(duration / 7) + 1)} khung ≈ vài chục cent/phim.
          </div>

          <div className="row between">
            <span className="hint" style={{ margin: 0 }}>Chạy hoàn toàn tự động sau khi bấm.</span>
            <button className="btn btn-primary" disabled={busy} onClick={submit}>
              {busy ? <span className="spin" /> : null} Tạo phim
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
