import { promises as fs } from "node:fs";
import path from "node:path";
import type { StepContext } from "../context";
import { store } from "../../store";
import type { Project, RenderOutput, Scene } from "../../types";
import { buildSRT, buildVTT } from "../../captions";
import { projectDir } from "../../paths";
import { nowISO } from "../../util";
import { resolveVariant } from "../context";

// CAPTION_GENERATION — đặc tả 8.18: phụ đề khớp voice (SRT + VTT tải về).
export async function captionGeneration(ctx: StepContext): Promise<void> {
  const { project } = ctx;
  const variant = await resolveVariant(ctx);
  const scenes = (await store().list<Scene>("scenes", { variant_id: variant.id } as Partial<Scene>)).sort(
    (a, b) => a.order - b.order
  );

  await ctx.setProgress(0.4, "Sinh phụ đề SRT/VTT");
  const dir = path.join(projectDir(project.id), "render");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `captions_${variant.id}.srt`), buildSRT(scenes), "utf8");
  await fs.writeFile(path.join(dir, `captions_${variant.id}.vtt`), buildVTT(scenes), "utf8");

  const existing = await store().get<RenderOutput>("renders", variant.id);
  await store().upsert<RenderOutput>("renders", {
    ...(existing ?? baseRender(variant.id, project.id)),
    srt_path: `/uploads/${project.id}/render/captions_${variant.id}.srt`,
    vtt_path: `/uploads/${project.id}/render/captions_${variant.id}.vtt`,
    updated_at: nowISO(),
  });
  await ctx.setProgress(1, `Đã tạo phụ đề cho ${scenes.length} cảnh`);
}

export function baseRender(variantId: string, projectId: string): RenderOutput {
  return {
    id: variantId,
    variant_id: variantId,
    project_id: projectId,
    voice_provider: "unknown",
    voice_path: null,
    audio_path: null,
    music_mode: "none",
    duration: 0,
    srt_path: null,
    vtt_path: null,
    preview_path: null,
    final_path: null,
    updated_at: nowISO(),
  };
}
