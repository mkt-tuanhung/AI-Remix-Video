import path from "node:path";
import type { StepContext } from "../context";
import { store } from "../../store";
import type { Asset, ContentVariant, Project, RenderOutput, Scene } from "../../types";
import { assembleFilm as assemble } from "../../media/assemble";
import { generateFalMusic, musicPromptFor } from "../../providers/music-gen";
import { generateAiBed } from "../../media/music";
import { projectDir, mediaAbs } from "../../paths";
import { nowISO } from "../../util";
import { primaryVariant } from "./storyboard";
import { baseRender } from "./caption-generation";

// ASSEMBLE_FILM — ghép các clip user tải lên (đã có thoại+SFX) + nhạc nền liên tục + phụ đề.
export async function assembleFilm(ctx: StepContext): Promise<void> {
  const { project } = ctx;
  const variant = await primaryVariant(project.id);
  if (!variant) throw new Error("Chưa có variant");
  const scenes = (await store().list<Scene>("scenes", { variant_id: variant.id } as Partial<Scene>)).sort(
    (a, b) => a.order - b.order
  );
  const clips = scenes
    .filter((s) => s.clip_url)
    .map((s) => ({ absPath: mediaAbs(s.clip_url!), caption: s.narration }));

  if (!clips.length) throw new Error("Chưa có clip nào được tải lên");

  await ctx.setProgress(0.2, "Chuẩn bị nhạc nền");
  const dir = path.join(projectDir(project.id), "render");
  let musicAbs: string | null = null;
  if ((project.music_mode ?? "ai_bed") !== "none") {
    const secs = Math.min(47, Math.max(12, clips.length * 8 + 2));
    const prompt = musicPromptFor(project.genre, project.goal);
    musicAbs =
      (await generateFalMusic(prompt, secs, path.join(dir, `music_${variant.id}.mp3`))) ||
      (await generateAiBed(secs, path.join(dir, `bed_${variant.id}.m4a`)));
  }

  const captions = project.assemble_captions !== false;
  await ctx.setProgress(0.5, `Ghép ${clips.length} clip${captions ? " + phụ đề" : ""}${musicAbs ? " + nhạc" : ""}`);
  const out = path.join(dir, `final_${variant.id}.mp4`);
  await assemble(clips, out, path.join(dir, `tmp_assemble_${variant.id}`), {
    captions,
    musicAbs,
  });

  const render = (await store().get<RenderOutput>("renders", variant.id)) ?? baseRender(variant.id, project.id);
  await store().upsert<RenderOutput>("renders", {
    ...render,
    final_path: `/uploads/${project.id}/render/final_${variant.id}.mp4`,
    music_mode: project.music_mode ?? "ai_bed",
    updated_at: nowISO(),
  });
  await store().update<ContentVariant>("variants", variant.id, { status: "RENDERED" });
  await store().update<Project>("projects", project.id, { status: "COMPLETED", updated_at: nowISO() });
  await ctx.setProgress(1, "Đã ghép phim hoàn chỉnh");
}
