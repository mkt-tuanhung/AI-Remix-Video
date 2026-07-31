import type { StepContext } from "../context";
import { store } from "../../store";
import type { ContentStrategy, ContentVariant, Hook, Project, SourceAnalysis } from "../../types";
import { generateHooks, generateStrategies, hookOverall, rewriteScript } from "../../providers/script";
import { nowISO, uid } from "../../util";
import { enqueueChain } from "../../orchestrator/queue";
import { STORYBOARD_PIPELINE } from "../registry";

// Doc bọc cho collection keyed theo project_id.
export interface StrategyDoc { id: string; items: ContentStrategy[] }
export interface HookDoc { id: string; items: Hook[] }

// SCRIPT_GENERATION — đặc tả 8.7–8.10: chiến lược, hook, viết lại kịch bản.
export async function scriptGeneration(ctx: StepContext): Promise<void> {
  const { project } = ctx;
  const analysis = await store().get<SourceAnalysis>("source_analyses", project.id);
  if (!analysis) throw new Error("Chưa có phân tích nguồn");

  const platform = project.target_platforms[0] ?? "tiktok";
  const lang = project.output_language ?? "en";

  await ctx.setProgress(0.2, "Đề xuất chiến lược nội dung");
  const strat = await generateStrategies(analysis, project.goal, platform, project.target_duration_seconds, lang);
  await store().upsert<StrategyDoc>("content_strategies", { id: project.id, items: strat.items });

  await ctx.setProgress(0.5, "Tạo các phương án hook");
  const hooksRes = await generateHooks(analysis, lang);
  const hooks = [...hooksRes.items].sort((a, b) => hookOverall(b) - hookOverall(a));
  await store().upsert<HookDoc>("hooks", { id: project.id, items: hooks });

  await ctx.setProgress(0.75, "Viết lại kịch bản theo thời lượng mục tiêu");
  const topHook = hooks[0];
  const topStrategy = strat.items[0];
  const rew = await rewriteScript(analysis, topHook, project.goal, project.target_duration_seconds, lang);

  // Tạo/cập nhật variant chính (variant đầu tiên của dự án).
  const existing = await store().list<ContentVariant>("variants", { project_id: project.id } as Partial<ContentVariant>);
  const primary = existing.find((v) => v.status === "DRAFT") ?? existing[0];
  const variant: ContentVariant = {
    id: primary?.id ?? uid("var"),
    project_id: project.id,
    platform,
    target_duration_seconds: project.target_duration_seconds,
    content_angle: topStrategy?.angle ?? "Kể lại hấp dẫn hơn",
    hook: topHook?.text ?? "",
    script: rew.script,
    cta: rew.cta,
    is_master: true,
    label: "Bản gốc (master)",
    status: "DRAFT",
    created_at: primary?.created_at ?? nowISO(),
  };
  await store().upsert<ContentVariant>("variants", variant);

  if (project.auto) {
    await store().update<Project>("projects", project.id, { status: "BUILDING_STORYBOARD", updated_at: nowISO() });
    await enqueueChain(project.id, STORYBOARD_PIPELINE);
  } else {
    await store().update<Project>("projects", project.id, {
      status: "WAITING_FOR_SCRIPT_APPROVAL",
      updated_at: nowISO(),
    });
  }

  await ctx.setProgress(
    1,
    `Kịch bản ~${rew.estimated_seconds}s (mục tiêu ${project.target_duration_seconds}s) · ${rew.provider}`
  );
}
