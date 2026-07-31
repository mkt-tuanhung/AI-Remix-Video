import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "../config";
import { synthesizeVoice, type VoiceOptions } from "../providers/tts";
import { runFfmpeg, probeDuration } from "./ffmpeg";
import { estimateSpeechSeconds } from "../util";

export interface VoiceFile {
  provider: "openai" | "elevenlabs" | "macos-say" | "silent";
  path: string; // đường dẫn tuyệt đối tới file audio (.m4a)
  duration: number; // giây (đo thật khi có audio)
}

function sh(bin: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args);
    p.on("error", reject);
    p.on("close", (c) => resolve(c ?? -1));
  });
}

/**
 * Sinh voice cho toàn bộ lời thoại và trả về file .m4a + thời lượng thật.
 * Ưu tiên: OpenAI/ElevenLabs (nếu có key) → macOS `say` → track im lặng.
 */
export async function generateVoice(
  text: string,
  outPath: string,
  opts: VoiceOptions = {}
): Promise<VoiceFile> {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const clean = text.replace(/\s+/g, " ").trim() || "…";

  // 1) TTS đám mây
  const cloud = await synthesizeVoice(clean, opts);
  if (cloud.audio) {
    const raw = outPath.replace(/\.m4a$/, ".src");
    await fs.writeFile(raw, cloud.audio);
    await runFfmpeg(["-y", "-i", raw, "-c:a", "aac", "-b:a", "128k", outPath]);
    await fs.rm(raw, { force: true });
    const dur = (await probeDuration(outPath)) ?? cloud.estimated_seconds;
    return { provider: cloud.provider as "openai" | "elevenlabs", path: outPath, duration: dur };
  }

  // 2) macOS `say` (giọng hệ thống) — có audio thật để video "ra lò"
  if (process.platform === "darwin") {
    try {
      const aiff = outPath.replace(/\.m4a$/, ".aiff");
      const voice = await pickSayVoice();
      const args = ["-o", aiff];
      if (voice) args.push("-v", voice);
      args.push(clean);
      const code = await sh("say", args);
      if (code === 0) {
        await runFfmpeg(["-y", "-i", aiff, "-c:a", "aac", "-b:a", "128k", outPath]);
        await fs.rm(aiff, { force: true });
        const dur = (await probeDuration(outPath)) ?? estimateSpeechSeconds(clean);
        return { provider: "macos-say", path: outPath, duration: dur };
      }
    } catch {
      /* rơi xuống silent */
    }
  }

  // 3) Track im lặng đúng thời lượng ước lượng (để video vẫn có độ dài chuẩn)
  const dur = Math.max(3, estimateSpeechSeconds(clean));
  await runFfmpeg([
    "-y",
    "-f", "lavfi",
    "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-t", String(dur),
    "-c:a", "aac", "-b:a", "96k",
    outPath,
  ]);
  return { provider: "silent", path: outPath, duration: dur };
}

// Tìm giọng tiếng Việt của `say` nếu có (VD "Linh"); nếu không, để mặc định.
let _sayVoice: string | null | undefined;
async function pickSayVoice(): Promise<string | null> {
  if (_sayVoice !== undefined) return _sayVoice;
  try {
    const out = await new Promise<string>((resolve) => {
      const p = spawn("say", ["-v", "?"]);
      let s = "";
      p.stdout.on("data", (d) => (s += d.toString()));
      p.on("close", () => resolve(s));
      p.on("error", () => resolve(""));
    });
    const line = out.split("\n").find((l) => /vi_VN|Vietnam/i.test(l));
    _sayVoice = line ? line.split(/\s{2,}/)[0].trim() : null;
  } catch {
    _sayVoice = null;
  }
  return _sayVoice;
}

export const FFMPEG_BIN = config.ffmpeg.ffmpeg;
