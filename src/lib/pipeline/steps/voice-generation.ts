import path from "node:path";
import type { StepContext } from "../context";
import { store } from "../../store";
import type { AudioMix, Project, RenderOutput, Scene } from "../../types";
import { generateVoice } from "../../media/audio";
import { projectDir } from "../../paths";
import { estimateSpeechSeconds, nowISO } from "../../util";
import { resolveVariant } from "../context";

// VOICE_GENERATION — đặc tả 8.16: tạo voice, đo thời lượng thật, refit timeline.
export async function voiceGeneration(ctx: StepContext): Promise<void> {
  const { project } = ctx;
  const variant = await resolveVariant(ctx);
  const scenes = (await store().list<Scene>("scenes", { variant_id: variant.id } as Partial<Scene>)).sort(
    (a, b) => a.order - b.order
  );
  if (!scenes.length) throw new Error("Chưa có cảnh");

  await ctx.setProgress(0.2, "Đang tạo voice");
  const narration = scenes.map((s) => s.narration).join(" ");
  const voicePath = path.join(projectDir(project.id), "render", `voice_${variant.id}.m4a`);
  const style = variant.voice_style || (project.goal === "news" ? "news" : project.goal === "sales" ? "sales" : "friendly");
  const voice = await generateVoice(narration, voicePath, { style });

  // Refit thời lượng cảnh theo voice thật, tỉ lệ theo độ dài lời từng cảnh.
  await ctx.setProgress(0.7, "Căn timeline theo voice thật");
  const weights = scenes.map((s) => Math.max(0.5, estimateSpeechSeconds(s.narration)));
  const totalW = weights.reduce((a, b) => a + b, 0) || 1;
  let t = 0;
  for (let i = 0; i < scenes.length; i++) {
    const dur = (weights[i] / totalW) * voice.duration;
    const start = round(t);
    t += dur;
    await store().update<Scene>("scenes", scenes[i].id, { start_time: start, end_time: round(t) });
  }

  // Lưu render output + audio mix (đặc tả 8.17 music ducking mặc định).
  const existing = await store().get<RenderOutput>("renders", variant.id);
  await store().upsert<RenderOutput>("renders", {
    id: variant.id,
    variant_id: variant.id,
    project_id: project.id,
    voice_provider: voice.provider,
    voice_path: `/uploads/${project.id}/render/voice_${variant.id}.m4a`,
    audio_path: existing?.audio_path ?? null,
    music_mode: project.music_mode ?? "none",
    duration: round(voice.duration),
    srt_path: existing?.srt_path ?? null,
    vtt_path: existing?.vtt_path ?? null,
    preview_path: existing?.preview_path ?? null,
    final_path: existing?.final_path ?? null,
    updated_at: nowISO(),
  });

  await store().upsert<AudioMix>("audio_mixes", {
    id: variant.id,
    variant_id: variant.id,
    voice_asset_id: null,
    music_asset_id: null,
    voice_gain_db: 0,
    music_gain_db: -18,
    ducking_enabled: true,
    ducking_reduction_db: 15,
    attack_ms: 200,
    release_ms: 800,
  });

  await store().update<Project>("projects", project.id, {
    status: "GENERATING_VOICE",
    updated_at: nowISO(),
  });
  await ctx.setProgress(1, `Voice ${voice.provider} · ${round(voice.duration)}s`);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
