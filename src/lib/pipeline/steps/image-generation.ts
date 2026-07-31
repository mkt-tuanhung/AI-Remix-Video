import path from "node:path";
import type { StepContext } from "../context";
import { store } from "../../store";
import type { Asset, Project, Scene } from "../../types";
import { generateSceneImage } from "../../providers/image";
import { projectDir } from "../../paths";
import { nowISO, uid } from "../../util";
import { primaryVariant } from "./storyboard";

// IMAGE_GENERATION — sinh ảnh AI cho từng khung (module Truyện → Phim).
export async function imageGeneration(ctx: StepContext): Promise<void> {
  const { project } = ctx;
  const variant = await primaryVariant(project.id);
  if (!variant) throw new Error("Chưa có variant");
  const scenes = (await store().list<Scene>("scenes", { variant_id: variant.id } as Partial<Scene>)).sort(
    (a, b) => a.order - b.order
  );
  if (!scenes.length) throw new Error("Chưa có khung nào");

  // Kích thước ảnh (gpt-image-1 hỗ trợ 1024x1536 dọc / 1024x1024 vuông).
  const size = project.aspect_ratio === "1:1" ? "1024x1024" : "1024x1536";

  let done = 0;
  let provider = "mock";
  for (const scene of scenes) {
    done++;
    await ctx.setProgress(done / scenes.length, `Sinh ảnh khung ${done}/${scenes.length}`);
    const assetId = uid("asset");
    const outAbs = path.join(projectDir(project.id), "assets", `${assetId}.png`);
    const res = await generateSceneImage(scene.image_prompt || scene.narration, outAbs, size);
    provider = res.provider;

    const asset: Asset = {
      id: assetId,
      project_id: project.id,
      type: "ai_visual",
      source_url: "",
      source_page_url: "",
      provider: res.provider === "openai" ? "openai:dall-e-3" : "mock",
      license: res.provider === "openai" ? "AI-generated" : "placeholder",
      width: Number(size.split("x")[0]),
      height: Number(size.split("x")[1]),
      duration_seconds: null,
      has_logo: false,
      quality_score: 0.9,
      relevance_score: 0.95,
      crop: null,
      local_path: `/uploads/${project.id}/assets/${assetId}.png`,
    };
    await store().insert<Asset>("assets", asset);
    // Ảnh AI dùng như "image" khi render (Ken Burns) — đặt asset_type image.
    await store().update<Scene>("scenes", scene.id, { asset_id: assetId, asset_type: "image" });
  }

  await store().update<Project>("projects", project.id, { status: "GENERATING_VOICE", updated_at: nowISO() });
  await ctx.setProgress(1, `Đã sinh ${scenes.length} ảnh (${provider})`);
}
