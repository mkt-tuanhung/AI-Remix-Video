import path from "node:path";
import type { StepContext } from "../context";
import { store } from "../../store";
import type { Project, RenderOutput, Scene } from "../../types";
import { renderVideo, PREVIEW_OPTS } from "../../media/render";
import { projectDir, mediaAbs } from "../../paths";
import { nowISO } from "../../util";
import { resolveVariant } from "../context";
import { baseRender } from "./caption-generation";
import { buildBgMap } from "./bg";

// PREVIEW_RENDER — đặc tả 8.24: render bản nháp độ phân giải thấp, nhanh.
export async function previewRender(ctx: StepContext): Promise<void> {
  const { project } = ctx;
  const variant = await resolveVariant(ctx);
  const scenes = (await store().list<Scene>("scenes", { variant_id: variant.id } as Partial<Scene>)).sort(
    (a, b) => a.order - b.order
  );
  const render = (await store().get<RenderOutput>("renders", variant.id)) ?? baseRender(variant.id, project.id);

  await store().update<Project>("projects", project.id, { status: "RENDERING_PREVIEW", updated_at: nowISO() });
  await ctx.setProgress(0.1, "Render bản nháp");

  const dir = path.join(projectDir(project.id), "render");
  const out = path.join(dir, `preview_${variant.id}.mp4`);
  const audioUrl = render.audio_path ?? render.voice_path;
  const voiceAbs = audioUrl ? mediaAbs(audioUrl) : null;
  const tmp = path.join(dir, `tmp_preview_${variant.id}`);

  const bgMap = await buildBgMap(project, scenes);
  const res = await renderVideo(scenes, voiceAbs, out, PREVIEW_OPTS, tmp, bgMap);

  await store().upsert<RenderOutput>("renders", {
    ...render,
    preview_path: `/uploads/${project.id}/render/preview_${variant.id}.mp4`,
    updated_at: nowISO(),
  });
  await ctx.setProgress(1, `Đã render nháp · ${res.footageScenes} cảnh footage, ${res.cardScenes} thẻ chữ`);
}
