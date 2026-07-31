import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "../config";

// Sinh NHẠC NỀN AI thật (fal stable-audio). Thiếu key → null → dùng synth bed.

export async function generateFalMusic(
  prompt: string,
  seconds: number,
  outPath: string
): Promise<string | null> {
  if (!config.fal.key) return null;
  try {
    const model = config.fal.musicModel;
    const body = JSON.stringify({
      prompt,
      seconds_total: Math.min(47, Math.max(10, Math.round(seconds))),
    });
    const res = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: { Authorization: `Key ${config.fal.key}`, "Content-Type": "application/json" },
      body,
    });
    const data: any = await res.json();
    const url =
      data?.audio_file?.url || data?.audio?.url || data?.audio_url || data?.file?.url;
    if (!url) return null;
    const a = await fetch(url);
    if (!a.ok) return null;
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, Buffer.from(await a.arrayBuffer()));
    return outPath;
  } catch {
    return null;
  }
}

// Prompt nhạc theo thể loại/mood.
export function musicPromptFor(genre: string | undefined, goal: string): string {
  const byGenre: Record<string, string> = {
    "2d": "playful whimsical cartoon background music, light and cheerful, instrumental",
    "3d": "warm magical cinematic storybook orchestral music, gentle and heartwarming, instrumental",
    epic: "epic emotional orchestral cinematic score, sweeping strings and drums, instrumental",
    papercut: "quirky charming acoustic folk music, cozy and handmade feel, instrumental",
    handdrawn: "soft warm acoustic guitar and piano, cozy storybook mood, instrumental",
    watercolor: "dreamy ambient piano music, soft and delicate, instrumental",
    realistic: "modern cinematic ambient background music, subtle and emotional, instrumental",
  };
  if (genre && byGenre[genre]) return byGenre[genre] + ", no vocals, loopable background";
  const byGoal: Record<string, string> = {
    sales: "upbeat motivational corporate background music, energetic, instrumental",
    news: "clean modern news background music, steady and neutral, instrumental",
  };
  return (byGoal[goal] || "uplifting cinematic background music, engaging, instrumental") + ", no vocals";
}
