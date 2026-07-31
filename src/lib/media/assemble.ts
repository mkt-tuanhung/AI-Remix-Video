import { promises as fs } from "node:fs";
import path from "node:path";
import { runFfmpeg } from "./ffmpeg";

// Ghép các clip user tải lên (đã có thoại + SFX từ Veo) thành phim hoàn chỉnh.
// Chuẩn hoá về 1080x1920/30fps/aac, (tuỳ chọn) burn phụ đề + nhạc nền nhẹ (ducking).

const FONT_CANDIDATES = [
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
];
let _font: string | null | undefined;
async function findFont(): Promise<string | null> {
  if (_font !== undefined) return _font;
  for (const f of FONT_CANDIDATES) {
    try { await fs.access(f); _font = f; return f; } catch { /* next */ }
  }
  _font = null;
  return null;
}
function wrap(text: string, maxChars: number): string {
  const words = text.split(/\s+/); const lines: string[] = []; let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars) { if (cur) lines.push(cur.trim()); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur.trim());
  return lines.join("\n");
}

const W = 1080, H = 1920, FPS = 30;

export interface AssembleClip {
  absPath: string;
  caption?: string;
}
export interface AssembleOpts {
  captions: boolean;
  musicAbs?: string | null; // nhạc nền (tuỳ chọn), sẽ ducking theo tiếng clip
}

export async function assembleFilm(
  clips: AssembleClip[],
  outPath: string,
  tmpDir: string,
  opts: AssembleOpts
): Promise<string> {
  await fs.mkdir(tmpDir, { recursive: true });
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const font = await findFont();

  // 1) Chuẩn hoá từng clip (cover-crop 9:16, 30fps, aac, giữ audio) + burn phụ đề.
  const normed: string[] = [];
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    const out = path.join(tmpDir, `norm_${i}.mp4`);
    const cover = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${FPS}`;
    let vf = cover;
    if (opts.captions && font && c.caption?.trim()) {
      const narFile = path.join(tmpDir, `cap_${i}.txt`);
      await fs.writeFile(narFile, wrap(c.caption.trim(), Math.round(W / 26)), "utf8");
      const fEsc = font.replace(/'/g, "\\'");
      const size = Math.round(W * 0.042);
      const scrim = `drawbox=x=0:y=${Math.round(H * 0.76)}:w=${W}:h=${Math.round(H * 0.24)}:color=black@0.42:t=fill`;
      const sub = `drawtext=fontfile='${fEsc}':textfile='${narFile}':fontcolor=white:fontsize=${size}:x=(w-text_w)/2:y=h*0.82:line_spacing=${Math.round(size * 0.24)}:borderw=${Math.max(2, Math.round(size * 0.085))}:bordercolor=0x081210@0.92:shadowcolor=black@0.5:shadowx=2:shadowy=2`;
      vf = `${cover},${scrim},${sub}`;
    }
    await runFfmpeg([
      "-y", "-i", c.absPath,
      "-vf", vf,
      "-r", String(FPS),
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20",
      "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "2",
      out,
    ]);
    normed.push(out);
  }

  // 2) Nối (concat demuxer — các clip đã cùng thông số).
  const listFile = path.join(tmpDir, "list.txt");
  await fs.writeFile(listFile, normed.map((c) => `file '${c}'`).join("\n"), "utf8");
  const joined = path.join(tmpDir, "joined.mp4");
  await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", joined]);

  // 3) Nhạc nền nhẹ (tuỳ chọn) — ducking theo chính tiếng thoại của clip.
  if (opts.musicAbs) {
    await runFfmpeg([
      "-y",
      "-i", joined,
      "-stream_loop", "-1", "-i", opts.musicAbs,
      "-filter_complex",
      `[0:a]aformat=sample_rates=44100:channel_layouts=stereo,asplit=2[a1][a2];` +
        `[1:a]volume=-16dB,aformat=sample_rates=44100:channel_layouts=stereo[m];` +
        `[m][a1]sidechaincompress=threshold=0.03:ratio=6:attack=200:release=600:makeup=1[duck];` +
        `[a2][duck]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[mix]`,
      "-map", "0:v:0", "-map", "[mix]",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
      "-shortest",
      outPath,
    ]);
  } else {
    await fs.copyFile(joined, outPath);
  }

  await Promise.all(normed.map((c) => fs.rm(c, { force: true })));
  return outPath;
}
