import path from "node:path";
import type { StepContext } from "../context";
import { store } from "../../store";
import type { Asset, Scene } from "../../types";
import { animateImage, hasVideoGen } from "../../providers/video-gen";
import { projectDir, mediaAbs } from "../../paths";
import { uid } from "../../util";
import { primaryVariant } from "./storyboard";

// VIDEO_ANIMATION — làm ảnh gốc chuyển động (image-to-video) qua fal LTX.
// Chỉ chạy khi motion_engine="fal" và có FAL_KEY; ngược lại bỏ qua (giữ ảnh tĩnh + Ken Burns).
export async function videoAnimation(ctx: StepContext): Promise<void> {
  const { project } = ctx;

  if (project.motion_engine !== "fal" || !hasVideoGen()) {
    await ctx.setProgress(1, "Bỏ qua chuyển động AI (dùng ảnh động Ken Burns)");
    return;
  }

  const variant = await primaryVariant(project.id);
  if (!variant) throw new Error("Chưa có variant");
  const scenes = (await store().list<Scene>("scenes", { variant_id: variant.id } as Partial<Scene>)).sort(
    (a, b) => a.order - b.order
  );

  const assets = await store().list<Asset>("assets", { project_id: project.id } as Partial<Asset>);
  const byId = new Map(assets.map((a) => [a.id, a]));

  let done = 0;
  let ok = 0;
  for (const scene of scenes) {
    done++;
    await ctx.setProgress(done / scenes.length, `Làm chuyển động khung ${done}/${scenes.length}`);
    const img = scene.asset_id ? byId.get(scene.asset_id) : undefined;
    if (!img?.local_path) continue;
    // Idempotent: khung đã được làm chuyển động (clip video) thì BỎ QUA — tránh tốn tiền chạy lại.
    if (img.type === "stock_video" || img.provider === "fal:ltx" || img.provider === "freepik") {
      ok++;
      continue;
    }

    const prompt =
      `${scene.visual_intent || scene.narration}. Subtle, natural character motion; the character moves and gestures gently; smooth cinematic slow camera; keep the same character design.`;
    const vid = uid("vid");
    const outAbs = path.join(projectDir(project.id), "assets", `${vid}.mp4`);
    const res = await animateImage(mediaAbs(img.local_path), prompt, outAbs);
    if (!res) continue; // giữ ảnh tĩnh nếu clip lỗi

    const asset: Asset = {
      id: vid,
      project_id: project.id,
      type: "stock_video", // để renderer coi là VIDEO nền (có chuyển động)
      source_url: "",
      source_page_url: "",
      provider: res.provider === "freepik" ? "freepik" : "fal:ltx",
      license: "AI-generated",
      width: img.width,
      height: img.height,
      duration_seconds: null,
      has_logo: false,
      quality_score: 0.9,
      relevance_score: 0.95,
      crop: null,
      local_path: `/uploads/${project.id}/assets/${vid}.mp4`,
    };
    await store().insert<Asset>("assets", asset);
    await store().update<Scene>("scenes", scene.id, { asset_id: vid, asset_type: "stock_video" });
    ok++;
  }

  await ctx.setProgress(1, `Đã làm chuyển động ${ok}/${scenes.length} khung (fal LTX)`);
}
