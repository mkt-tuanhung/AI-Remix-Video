import type { StepContext } from "../context";
import { store } from "../../store";
import type { Project, SourceAnalysis } from "../../types";
import { understandContent } from "../../providers/llm";
import { nowISO } from "../../util";
import { emptyAnalysis } from "./transcribe";
import { enqueueChain } from "../../orchestrator/queue";
import { SCRIPT_PIPELINE } from "../registry";

// CONTENT_ANALYSIS — đặc tả 8.5 & 8.6: hiểu nội dung đa phương thức + bản đồ dữ kiện.
export async function contentAnalysis(ctx: StepContext): Promise<void> {
  const { project } = ctx;
  const analysis = (await store().get<SourceAnalysis>("source_analyses", project.id)) ?? emptyAnalysis(project.id);

  await ctx.setProgress(0.3, "Hiểu chủ đề, dữ kiện và thực thể");
  const u = await understandContent(analysis.transcript, analysis.shots);

  await store().upsert<SourceAnalysis>("source_analyses", {
    ...analysis,
    main_topic: u.main_topic,
    entities: u.entities,
    facts: u.facts,
    uncertain_claims: u.uncertain_claims,
    source_hook: u.source_hook,
    source_cta: u.source_cta,
    conflicts: u.conflicts,
    updated_at: nowISO(),
  });

  // Chế độ tự động (batch): tự duyệt transcript + đi tiếp; ngược lại chờ Gate 1.
  if (project.auto) {
    await store().upsert<SourceAnalysis>("source_analyses", {
      ...(await store().get<SourceAnalysis>("source_analyses", project.id))!,
      transcript_approved: true,
      updated_at: nowISO(),
    });
    await store().update<Project>("projects", project.id, { status: "PLANNING_CONTENT", updated_at: nowISO() });
    await enqueueChain(project.id, SCRIPT_PIPELINE);
  } else {
    await store().update<Project>("projects", project.id, {
      status: "WAITING_FOR_TRANSCRIPT_APPROVAL",
      updated_at: nowISO(),
    });
  }

  await ctx.setProgress(1, `Đã hiểu nội dung bằng ${u.provider}`);
}
