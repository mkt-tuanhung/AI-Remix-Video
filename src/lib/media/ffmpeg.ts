import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "../config";

// Wrapper ffmpeg/ffprobe. Thiếu binary -> trả về null / mock, không làm sập pipeline.

let _available: boolean | null = null;

function run(bin: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args);
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => (stdout += d.toString()));
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("error", reject);
    p.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

/** Chạy ffmpeg với args tuỳ ý. Ném lỗi kèm stderr nếu thất bại. */
export async function runFfmpeg(args: string[]): Promise<void> {
  const r = await run(config.ffmpeg.ffmpeg, args);
  if (r.code !== 0) {
    throw new Error(`ffmpeg lỗi (code ${r.code}): ${r.stderr.split("\n").slice(-6).join("\n")}`);
  }
}

/** Đo thời lượng (giây) của 1 file media. Trả null nếu không đọc được. */
export async function probeDuration(filePath: string): Promise<number | null> {
  const meta = await probe(filePath);
  return meta?.duration_seconds ?? null;
}

export function ffprobeBin() {
  return config.ffmpeg.ffprobe;
}

export async function ffmpegAvailable(): Promise<boolean> {
  if (_available !== null) return _available;
  try {
    const r = await run(config.ffmpeg.ffprobe, ["-version"]);
    _available = r.code === 0;
  } catch {
    _available = false;
  }
  return _available;
}

export interface ProbeResult {
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  has_audio: boolean;
}

export async function probe(filePath: string): Promise<ProbeResult | null> {
  if (!(await ffmpegAvailable())) return null;
  try {
    const r = await run(config.ffmpeg.ffprobe, [
      "-v", "error",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      filePath,
    ]);
    if (r.code !== 0) return null;
    const data = JSON.parse(r.stdout);
    const streams: any[] = data.streams || [];
    const v = streams.find((s) => s.codec_type === "video");
    const a = streams.find((s) => s.codec_type === "audio");
    let fps: number | null = null;
    if (v?.r_frame_rate && v.r_frame_rate.includes("/")) {
      const [n, d] = v.r_frame_rate.split("/").map(Number);
      if (d) fps = Math.round((n / d) * 100) / 100;
    }
    return {
      duration_seconds: data.format?.duration ? Number(data.format.duration) : null,
      width: v?.width ?? null,
      height: v?.height ?? null,
      fps,
      has_audio: !!a,
    };
  } catch {
    return null;
  }
}

/** Trích 1 keyframe (jpg) tại giây `t`. Trả về đường dẫn tuyệt đối hoặc null. */
export async function extractFrame(filePath: string, t: number, outPath: string): Promise<string | null> {
  if (!(await ffmpegAvailable())) return null;
  try {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    const r = await run(config.ffmpeg.ffmpeg, [
      "-y",
      "-ss", String(t),
      "-i", filePath,
      "-frames:v", "1",
      "-q:v", "3",
      outPath,
    ]);
    if (r.code !== 0) return null;
    return outPath;
  } catch {
    return null;
  }
}

/** Tách audio WAV mono 16k để đưa vào Whisper. Trả về đường dẫn hoặc null. */
export async function extractAudio(filePath: string, outPath: string): Promise<string | null> {
  if (!(await ffmpegAvailable())) return null;
  try {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    const r = await run(config.ffmpeg.ffmpeg, [
      "-y",
      "-i", filePath,
      "-vn",
      "-ac", "1",
      "-ar", "16000",
      outPath,
    ]);
    if (r.code !== 0) return null;
    return outPath;
  } catch {
    return null;
  }
}
