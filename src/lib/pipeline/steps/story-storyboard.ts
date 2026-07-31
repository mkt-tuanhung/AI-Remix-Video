import type { StepContext } from "../context";
import { store } from "../../store";
import type { ContentVariant, Project, Scene } from "../../types";
import { splitStoryScenes } from "../../providers/story";
import { nowISO } from "../../util";
import { primaryVariant } from "./storyboard";

// STORY_STORYBOARD — chia kịch bản thành khung + prompt ảnh theo thể loại.
export async function storyStoryboard(ctx: StepContext): Promise<void> {
  const { project } = ctx;
  const variant = await primaryVariant(project.id);
  if (!variant) throw new Error("Chưa có kịch bản");

  await ctx.setProgress(0.3, "Chia khung hình + tạo prompt ảnh");
  const res = await splitStoryScenes(
    project.title,
    variant.script,
    project.genre ?? "2d",
    project.output_language ?? "en",
    variant.id,
    variant.target_duration_seconds
  );

  const old = await store().list<Scene>("scenes", { variant_id: variant.id } as Partial<Scene>);
  for (const s of old) await store().remove("scenes", s.id);
  for (const s of res.scenes) await store().insert<Scene>("scenes", s);

  // Lưu dàn nhân vật vào variant (hiển thị + prompt Veo).
  if (res.characters.length) {
    await store().update<ContentVariant>("variants", variant.id, { characters: res.characters });
  }

  await store().update<Project>("projects", project.id, { status: "GENERATING_ASSETS", updated_at: nowISO() });
  await ctx.setProgress(1, `Đã tạo ${res.scenes.length} khung (${res.provider})`);
}
