import { promises as fs } from "node:fs";
import path from "node:path";
import type { Scene } from "../types";
import { runFfmpeg } from "./ffmpeg";

// Renderer: mỗi cảnh dựng thành 1 clip dọc.
// - Có footage (video/ảnh Pexels hoặc cảnh nguồn) → dùng làm nền, phủ scrim + chữ.
// - Không có → thẻ nền teal + chữ (fallback).
// Dùng drawtext (không phụ thuộc libass). Lỗi footage ở 1 cảnh → tự fallback thẻ chữ.

export type SceneBg = { kind: "video" | "image"; path: string };

const FONT_CANDIDATES = [
  // macOS (dev)
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
  "/Library/Fonts/Arial.ttf",
  "/System/Library/Fonts/Supplemental/Verdana.ttf",
  // Linux / Docker (prod) — cài qua apt fonts-dejavu-core
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans.ttf",
];

let _font: string | null | undefined;
async function findFont(): Promise<string | null> {
  if (_font !== undefined) return _font;
  for (const f of FONT_CANDIDATES) {
    try {
      await fs.access(f);
      _font = f;
      return f;
    } catch {
      /* thử tiếp */
    }
  }
  _font = null;
  return null;
}

// Xuống dòng theo ĐỘ RỘNG PIXEL (không theo số ký tự) để chữ không tràn khung.
// Ước lượng bề rộng glyph ~ 0.52*fontsize cho font sans (Arial), tính cả dấu tiếng Việt.
function wrapPx(text: string, fontSize: number, maxWidthPx: number): string {
  const avg = fontSize * 0.52;
  const maxChars = Math.max(6, Math.floor(maxWidthPx / avg));
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    // từ quá dài cũng cắt cứng
    if (w.length > maxChars) {
      if (cur) { lines.push(cur); cur = ""; }
      for (let i = 0; i < w.length; i += maxChars) lines.push(w.slice(i, i + maxChars));
      continue;
    }
    if ((cur + " " + w).trim().length > maxChars) {
      if (cur) lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur.trim());
  return lines.join("\n");
}

export interface RenderOpts {
  width: number;
  height: number;
  fps: number;
  crf: number;
  preset: string;
}

export const PREVIEW_OPTS: RenderOpts = { width: 720, height: 1280, fps: 24, crf: 30, preset: "veryfast" };
export const FINAL_OPTS: RenderOpts = { width: 1080, height: 1920, fps: 30, crf: 20, preset: "medium" };

// Phụ đề kiểu TikTok/CapCut: chữ đậm, VIỀN + đổ bóng (không dùng box thô),
// canh giữa, neo ở 1/3 dưới, nằm trong vùng an toàn.
function subtitle(font: string, W: number, H: number, narFile: string, narSize: number, lines: number, centered: boolean): string {
  const fontEsc = font.replace(/'/g, "\\'");
  const ls = Math.round(narSize * 0.24);
  const lineH = narSize + ls;
  const blockH = lines * lineH;
  const bw = Math.max(2, Math.round(narSize * 0.085));
  const sh = Math.max(1, Math.round(narSize * 0.045));
  // Card: canh giữa dọc. Footage: neo SÁT đáy (gọn, không chiếm màn hình).
  const y = centered
    ? Math.round((H - blockH) / 2)
    : Math.max(Math.round(H * 0.62), Math.round(H * 0.87 - blockH));
  return (
    `drawtext=fontfile='${fontEsc}':textfile='${narFile}':fontcolor=white:fontsize=${narSize}` +
    `:x=(w-text_w)/2:y=${y}:line_spacing=${ls}` +
    `:borderw=${bw}:bordercolor=0x081210@0.92:shadowcolor=black@0.5:shadowx=${sh}:shadowy=${sh}`
  );
}

function brand(font: string, W: number, H: number): string {
  const fontEsc = font.replace(/'/g, "\\'");
  return `drawtext=fontfile='${fontEsc}':text='AI Remix':fontcolor=white@0.55:fontsize=${Math.round(
    W * 0.03
  )}:x=(w-text_w)/2:y=${Math.round(H * 0.955)}:shadowcolor=black@0.4:shadowx=1:shadowy=1`;
}

async function renderCard(
  dur: number,
  clip: string,
  font: string,
  opts: RenderOpts,
  narFile: string,
  narSize: number,
  lines: number
): Promise<void> {
  const { width: W, height: H, fps } = opts;
  // Nền teal đậm, chấm accent mint ở trên cho có điểm nhấn nhẹ.
  const accent = `drawbox=x=${Math.round(W * 0.44)}:y=${Math.round(H * 0.30)}:w=${Math.round(W * 0.12)}:h=${Math.round(
    H * 0.006
  )}:color=0x2dd4bf:t=fill`;
  const vf = [accent, subtitle(font, W, H, narFile, narSize, lines, true), brand(font, W, H)].join(",");
  await runFfmpeg([
    "-y",
    "-f", "lavfi",
    "-i", `color=c=0x0c2b28:s=${W}x${H}:r=${fps}`,
    "-t", String(dur),
    "-vf", vf,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", opts.preset, "-crf", String(opts.crf),
    clip,
  ]);
}

async function renderFootage(
  bg: SceneBg,
  dur: number,
  clip: string,
  font: string,
  opts: RenderOpts,
  narFile: string,
  narSize: number,
  lines: number
): Promise<void> {
  const { width: W, height: H, fps } = opts;
  const cover = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;
  // Scrim GỌN chỉ ở dải đáy (~24%) nơi có phụ đề — footage giữ tối đa diện tích.
  const scrim = `drawbox=x=0:y=${Math.round(H * 0.76)}:w=${W}:h=${Math.round(H * 0.24)}:color=black@0.42:t=fill`;
  const ov = `${scrim},${subtitle(font, W, H, narFile, narSize, lines, false)},${brand(font, W, H)}`;

  if (bg.kind === "image") {
    const frames = Math.max(1, Math.round(dur * fps));
    const kb = `zoompan=z='min(zoom+0.0009,1.14)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${fps}`;
    const vf = `${cover},${kb},${ov}`;
    await runFfmpeg([
      "-y",
      "-i", bg.path,
      "-t", String(dur),
      "-vf", vf,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", opts.preset, "-crf", String(opts.crf),
      clip,
    ]);
  } else {
    const vf = `${cover},fps=${fps},${ov}`;
    await runFfmpeg([
      "-y",
      "-stream_loop", "-1", "-i", bg.path,
      "-t", String(dur),
      "-an",
      "-vf", vf,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", opts.preset, "-crf", String(opts.crf),
      clip,
    ]);
  }
}

/**
 * Render video từ các cảnh + voice, dùng footage (bgMap) khi có.
 */
export async function renderVideo(
  scenes: Scene[],
  voicePath: string | null,
  outPath: string,
  opts: RenderOpts,
  tmpDir: string,
  bgMap?: Map<string, SceneBg>
): Promise<{ path: string; footageScenes: number; cardScenes: number }> {
  const font = await findFont();
  if (!font) throw new Error("Không tìm thấy font hệ thống để vẽ chữ (drawtext).");

  await fs.mkdir(tmpDir, { recursive: true });
  await fs.mkdir(path.dirname(outPath), { recursive: true });

  const { width: W } = opts;
  const clips: string[] = [];
  let footageScenes = 0;
  let cardScenes = 0;

  // Cỡ chữ phụ đề + vùng an toàn (84% bề rộng) → wrap theo pixel để không tràn.
  const narSize = Math.round(W * 0.042);
  const safeW = W * 0.86;

  const XF = 0.45; // thời lượng crossfade giữa các cảnh (giây)
  const multi = scenes.length > 1;
  const clipDurs: number[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    const dur = Math.max(1.2, sc.end_time - sc.start_time);
    // Kéo dài mỗi cảnh thêm XF để phần chồng crossfade không "ăn" nội dung,
    // giữ tổng thời lượng ≈ voice (đồng bộ lời + phụ đề).
    const clipDur = dur + (multi ? XF : 0);
    clipDurs.push(clipDur);
    const clip = path.join(tmpDir, `scene_${i}.mp4`);

    const narFile = path.join(tmpDir, `nar_${i}.txt`);
    const wrapped = wrapPx(sc.narration, narSize, safeW);
    const lines = wrapped.split("\n").length;
    await fs.writeFile(narFile, wrapped, "utf8");

    const bg = bgMap?.get(sc.id);
    if (bg) {
      try {
        await renderFootage(bg, clipDur, clip, font, opts, narFile, narSize, lines);
        footageScenes++;
      } catch {
        await renderCard(clipDur, clip, font, opts, narFile, narSize, lines);
        cardScenes++;
      }
    } else {
      await renderCard(clipDur, clip, font, opts, narFile, narSize, lines);
      cardScenes++;
    }
    clips.push(clip);
  }

  // Nối cảnh: crossfade mượt (xfade) khi có nhiều cảnh.
  const silent = path.join(tmpDir, "silent.mp4");
  if (clips.length === 1) {
    await fs.copyFile(clips[0], silent);
  } else {
    const inputs = clips.flatMap((c) => ["-i", c]);
    let filter = "";
    let prev = "[0:v]";
    let acc = clipDurs[0];
    for (let i = 1; i < clips.length; i++) {
      const off = Math.max(0, Math.round((acc - XF) * 1000) / 1000);
      const out = i === clips.length - 1 ? "[vout]" : `[vx${i}]`;
      filter += `${prev}[${i}:v]xfade=transition=fade:duration=${XF}:offset=${off}${out};`;
      prev = out;
      acc = acc + clipDurs[i] - XF;
    }
    filter = filter.replace(/;$/, "");
    try {
      await runFfmpeg([
        "-y", ...inputs,
        "-filter_complex", filter,
        "-map", "[vout]",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", opts.preset, "-crf", String(opts.crf),
        silent,
      ]);
    } catch {
      // Fallback: nếu xfade lỗi → nối cứng để không hỏng cả video.
      const listFile = path.join(tmpDir, "concat.txt");
      await fs.writeFile(listFile, clips.map((c) => `file '${c}'`).join("\n"), "utf8");
      await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", silent]);
    }
  }

  // Ghép voice (-shortest cắt phần XF dư ở đuôi video, giữ trọn lời).
  if (voicePath) {
    await runFfmpeg([
      "-y",
      "-i", silent,
      "-i", voicePath,
      "-map", "0:v:0", "-map", "1:a:0",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
      "-shortest",
      outPath,
    ]);
  } else {
    await fs.copyFile(silent, outPath);
  }

  await Promise.all(clips.map((c) => fs.rm(c, { force: true })));
  return { path: outPath, footageScenes, cardScenes };
}
