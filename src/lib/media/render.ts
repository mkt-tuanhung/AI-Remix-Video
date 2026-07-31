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
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
  "/Library/Fonts/Arial.ttf",
  "/System/Library/Fonts/Supplemental/Verdana.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
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

function wrap(text: string, maxChars: number): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
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

/** Chuỗi drawtext phủ lên nền (giống nhau cho footage & thẻ chữ). */
function overlays(
  font: string,
  W: number,
  H: number,
  order: number,
  kwFile: string,
  narFile: string,
  hasKw: boolean,
  onFootage: boolean
): string {
  const fontEsc = font.replace(/'/g, "\\'");
  const kwSize = Math.round(W * 0.075);
  const narSize = Math.round(W * 0.052);
  const box = onFootage ? `:box=1:boxcolor=0x0b1f1c@0.45:boxborderw=${Math.round(W * 0.02)}` : "";

  return [
    `drawbox=x=0:y=0:w=${W}:h=${Math.round(H * 0.007)}:color=0x2dd4bf:t=fill`,
    `drawtext=fontfile='${fontEsc}':text='${order + 1}':fontcolor=0x2dd4bf:fontsize=${Math.round(
      W * 0.05
    )}:x=${Math.round(W * 0.06)}:y=${Math.round(H * 0.05)}`,
    hasKw
      ? `drawtext=fontfile='${fontEsc}':textfile='${kwFile}':fontcolor=0x5eead4:fontsize=${kwSize}:x=(w-text_w)/2:y=h*0.20:line_spacing=12${box}`
      : null,
    `drawtext=fontfile='${fontEsc}':textfile='${narFile}':fontcolor=white:fontsize=${narSize}:x=(w-text_w)/2:y=h*0.66:line_spacing=16:box=1:boxcolor=0x0b1f1c@0.55:boxborderw=${Math.round(
      W * 0.03
    )}`,
    `drawtext=fontfile='${fontEsc}':text='AI Remix':fontcolor=0x94a3a0:fontsize=${Math.round(
      W * 0.035
    )}:x=(w-text_w)/2:y=h*0.93`,
  ]
    .filter(Boolean)
    .join(",");
}

async function renderCard(
  scene: Scene,
  dur: number,
  clip: string,
  font: string,
  opts: RenderOpts,
  kwFile: string,
  narFile: string,
  hasKw: boolean
): Promise<void> {
  const { width: W, height: H, fps } = opts;
  const vf = overlays(font, W, H, scene.order, kwFile, narFile, hasKw, false);
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
  scene: Scene,
  bg: SceneBg,
  dur: number,
  clip: string,
  font: string,
  opts: RenderOpts,
  kwFile: string,
  narFile: string,
  hasKw: boolean
): Promise<void> {
  const { width: W, height: H, fps } = opts;
  const cover = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;
  const darken = `drawbox=x=0:y=0:w=iw:h=ih:color=0x0b1f1c@0.32:t=fill`;
  const ov = overlays(font, W, H, scene.order, kwFile, narFile, hasKw, true);

  if (bg.kind === "image") {
    const frames = Math.max(1, Math.round(dur * fps));
    // Ken Burns nhẹ: zoom dần.
    const kb = `zoompan=z='min(zoom+0.0009,1.14)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${fps}`;
    const vf = `${cover},${kb},${darken},${ov}`;
    // Lưu ý: KHÔNG dùng -loop 1 ở đây — zoompan tự sinh đủ số frame; -loop gây lỗi decode.
    await runFfmpeg([
      "-y",
      "-i", bg.path,
      "-t", String(dur),
      "-vf", vf,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", opts.preset, "-crf", String(opts.crf),
      clip,
    ]);
  } else {
    const vf = `${cover},fps=${fps},${darken},${ov}`;
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

  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    const dur = Math.max(1.2, sc.end_time - sc.start_time);
    const clip = path.join(tmpDir, `scene_${i}.mp4`);

    const kwFile = path.join(tmpDir, `kw_${i}.txt`);
    const narFile = path.join(tmpDir, `nar_${i}.txt`);
    // Từ khoá: cắt ngắn + xuống dòng để không tràn mép (GPT đôi khi trả cả cụm dài).
    const kwRaw = (sc.on_screen_text || "").trim();
    const kw = kwRaw ? wrap(kwRaw.toUpperCase(), 16) : "";
    await fs.writeFile(kwFile, kw, "utf8");
    await fs.writeFile(narFile, wrap(sc.narration, Math.round(W / 26)), "utf8");

    const bg = bgMap?.get(sc.id);
    if (bg) {
      try {
        await renderFootage(sc, bg, dur, clip, font, opts, kwFile, narFile, !!kw);
        footageScenes++;
      } catch {
        // Footage lỗi (file hỏng, codec lạ…) → fallback thẻ chữ, không làm hỏng cả video.
        await renderCard(sc, dur, clip, font, opts, kwFile, narFile, !!kw);
        cardScenes++;
      }
    } else {
      await renderCard(sc, dur, clip, font, opts, kwFile, narFile, !!kw);
      cardScenes++;
    }
    clips.push(clip);
  }

  // Nối cảnh
  const listFile = path.join(tmpDir, "concat.txt");
  await fs.writeFile(listFile, clips.map((c) => `file '${c}'`).join("\n"), "utf8");
  const silentConcat = path.join(tmpDir, "concat.mp4");
  await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", silentConcat]);

  // Ghép voice
  if (voicePath) {
    await runFfmpeg([
      "-y",
      "-i", silentConcat,
      "-i", voicePath,
      "-map", "0:v:0", "-map", "1:a:0",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
      "-shortest",
      outPath,
    ]);
  } else {
    await fs.copyFile(silentConcat, outPath);
  }

  await Promise.all(clips.map((c) => fs.rm(c, { force: true })));
  return { path: outPath, footageScenes, cardScenes };
}
