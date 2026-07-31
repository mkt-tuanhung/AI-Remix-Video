import path from "node:path";
import type { StepContext } from "../context";
import { store } from "../../store";
import type { ContentVariant, Project, RenderOutput, Scene } from "../../types";
import { renderVideo, FINAL_OPTS } from "../../media/render";
import { projectDir, mediaAbs } from "../../paths";
import { nowISO } from "../../util";
import { resolveVariant } from "../context";
import { baseRender } from "./caption-generation";
import { buildBgMap } from "./bg";

// FINAL_RENDER — đặc tả 8.24: render bản cuối chất lượng cao (1080x1920).
export async function finalRender(ctx: StepContext): Promise<void> {
  const { project } = ctx;
  const variant = await resolveVariant(ctx);
  const scenes = (await store().list<Scene>("scenes", { variant_id: variant.id } as Partial<Scene>)).sort(
    (a, b) => a.order - b.order
  );
  const render = (await store().get<RenderOutput>("renders", variant.id)) ?? baseRender(variant.id, project.id);

  await store().update<Project>("projects", project.id, { status: "RENDERING_FINAL", updated_at: nowISO() });
  await ctx.setProgress(0.1, "Render bản cuối 1080×1920");

  const dir = path.join(projectDir(project.id), "render");
  const out = path.join(dir, `final_${variant.id}.mp4`);
  const audioUrl = render.audio_path ?? render.voice_path;
  const voiceAbs = audioUrl ? mediaAbs(audioUrl) : null;
  const tmp = path.join(dir, `tmp_final_${variant.id}`);

  const bgMap = await buildBgMap(project, scenes);
  await renderVideo(scenes, voiceAbs, out, FINAL_OPTS, tmp, bgMap);

  await store().upsert<RenderOutput>("renders", {
    ...render,
    final_path: `/uploads/${project.id}/render/final_${variant.id}.mp4`,
    updated_at: nowISO(),
  });
  await store().update<ContentVariant>("variants", variant.id, { status: "RENDERED" });
  // Chỉ đổi trạng thái dự án khi render variant GỐC (master). A/B không đụng status dự án.
  if (variant.is_master !== false) {
    await store().update<Project>("projects", project.id, { status: "COMPLETED", updated_at: nowISO() });
  }
  await ctx.setProgress(1, "Đã render bản cuối");
}
