import type { StepContext } from "../context";
import { store } from "../../store";
import type { ContentVariant, Project, Scene, SourceAnalysis } from "../../types";
import { splitStoryboard } from "../../providers/script";
import { nowISO } from "../../util";

// STORYBOARD — đặc tả 8.11: chia cảnh theo ý nghĩa.
export async function storyboard(ctx: StepContext): Promise<void> {
  const { project } = ctx;
  const analysis = await store().get<SourceAnalysis>("source_analyses", project.id);
  if (!analysis) throw new Error("Chưa có phân tích nguồn");

  const variant = await primaryVariant(project.id);
  if (!variant) throw new Error("Chưa có kịch bản để dựng storyboard");

  await ctx.setProgress(0.3, "Chia cảnh theo ý nghĩa");
  const res = await splitStoryboard(
    variant.script,
    variant.cta,
    analysis,
    variant.id,
    variant.target_duration_seconds,
    project.output_language ?? "en"
  );

  // Xoá scene cũ của variant rồi ghi mới.
  const old = await store().list<Scene>("scenes", { variant_id: variant.id } as Partial<Scene>);
  for (const s of old) await store().remove("scenes", s.id);
  for (const s of res.scenes) await store().insert<Scene>("scenes", s);

  await store().update<Project>("projects", project.id, {
    status: "GENERATING_ASSETS",
    updated_at: nowISO(),
  });

  await ctx.setProgress(1, `Đã tạo ${res.scenes.length} cảnh (${res.provider})`);
}

/** Variant gốc (master) = variant cũ nhất của dự án. */
export async function primaryVariant(projectId: string): Promise<ContentVariant | null> {
  const list = await store().list<ContentVariant>("variants", { project_id: projectId } as Partial<ContentVariant>);
  if (!list.length) return null;
  return list.sort((a, b) => (a.created_at < b.created_at ? -1 : 1))[0];
}
