import path from "node:path";
import type { StepContext } from "../context";
import { store } from "../../store";
import type { AudioMix, Project, RenderOutput } from "../../types";
import { generateAiBed, mixVoiceMusic } from "../../media/music";
import { projectDir, mediaAbs as abs } from "../../paths";
import { nowISO } from "../../util";
import { resolveVariant } from "../context";
import { baseRender } from "./caption-generation";

// MUSIC_MIX — đặc tả 8.17: chọn/phối nhạc, music ducking (voice là lớp chính).
export async function musicMix(ctx: StepContext): Promise<void> {
  const { project } = ctx;
  const variant = await resolveVariant(ctx);
  const render = (await store().get<RenderOutput>("renders", variant.id)) ?? baseRender(variant.id, project.id);

  const mode = project.music_mode ?? "none";
  if (mode === "none" || !render.voice_path) {
    await store().upsert<RenderOutput>("renders", { ...render, audio_path: null, music_mode: mode, updated_at: nowISO() });
    await ctx.setProgress(1, "Không dùng nhạc nền (voice thuần)");
    return;
  }

  await ctx.setProgress(0.3, "Chuẩn bị nhạc nền");
  const dir = path.join(projectDir(project.id), "render");
  let musicAbs: string;
  if (mode === "ai_bed") {
    musicAbs = await generateAiBed(render.duration || 30, path.join(dir, `bed_${variant.id}.m4a`));
  } else {
    if (!project.music_path) {
      await store().upsert<RenderOutput>("renders", { ...render, audio_path: null, music_mode: "none", updated_at: nowISO() });
      await ctx.setProgress(1, "Chưa có file nhạc tải lên — dùng voice thuần");
      return;
    }
    musicAbs = abs(project.music_path);
  }

  await ctx.setProgress(0.6, "Trộn voice + nhạc (ducking)");
  const mix = await store().get<AudioMix>("audio_mixes", variant.id);
  const outAbs = path.join(dir, `audio_${variant.id}.m4a`);
  await mixVoiceMusic(abs(render.voice_path), musicAbs, outAbs, {
    musicGainDb: mix?.music_gain_db ?? -18,
    duckingReductionDb: mix?.ducking_reduction_db ?? 15,
    attackMs: mix?.attack_ms ?? 200,
    releaseMs: mix?.release_ms ?? 800,
  });

  await store().upsert<RenderOutput>("renders", {
    ...render,
    audio_path: `/uploads/${project.id}/render/audio_${variant.id}.m4a`,
    music_mode: mode,
    updated_at: nowISO(),
  });
  await ctx.setProgress(1, `Đã phối nhạc (${mode}) + ducking`);
}
