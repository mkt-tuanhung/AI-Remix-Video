import type { StepContext } from "../context";
import { store } from "../../store";
import type {
  ContentVariant,
  Project,
  QualityIssue,
  QualityReport,
  RenderOutput,
  Scene,
  SourceAnalysis,
} from "../../types";
import { clamp, nowISO } from "../../util";
import { resolveVariant } from "../context";
import { enqueueChain } from "../../orchestrator/queue";
import { FINAL_PIPELINE } from "../registry";

// QUALITY_CHECK — đặc tả mục 9: chấm điểm chất lượng tổng hợp.
export async function qualityCheck(ctx: StepContext): Promise<void> {
  const { project } = ctx;
  const variant = await resolveVariant(ctx);
  const scenes = await store().list<Scene>("scenes", { variant_id: variant.id } as Partial<Scene>);
  const analysis = await store().get<SourceAnalysis>("source_analyses", project.id);
  const render = await store().get<RenderOutput>("renders", variant.id);

  await ctx.setProgress(0.4, "Chấm điểm chất lượng");

  const issues: QualityIssue[] = [];

  // Scene–voice match trung bình.
  const matches = scenes.map((s) => s.scene_voice_match_score ?? 0.5);
  const sceneVoiceMatch = pct(avg(matches));
  scenes.forEach((s) => {
    if ((s.scene_voice_match_score ?? 1) < 0.6) {
      issues.push({
        code: "low_scene_match",
        severity: "warning",
        message: `Cảnh ${s.order + 1} khớp lời thấp — nên đổi tài nguyên`,
        scene_id: s.id,
      });
    }
  });

  // Voice.
  const vp = render?.voice_provider ?? "unknown";
  const voiceQuality = vp === "openai" || vp === "elevenlabs" ? 92 : vp === "macos-say" ? 78 : 58;
  if (vp === "silent") {
    issues.push({
      code: "silent_voice",
      severity: "warning",
      message: "Voice đang im lặng (chưa cắm TTS). Cắm OPENAI_API_KEY để có giọng đọc thật.",
    });
  }

  // Creative difference: khác biệt so với transcript nguồn.
  const creative = creativeDifference(variant, analysis);
  if (creative < 55) {
    issues.push({ code: "low_creative", severity: "warning", message: "Khác biệt sáng tạo còn thấp so với bản gốc." });
  }

  // Các tiêu chí còn lại (heuristic hợp lý cho MVP).
  const factConsistency = analysis && analysis.facts.length ? 95 : 85;
  const captionSync = render?.srt_path ? 92 : 70;
  const musicDucking = 88; // cấu hình ducking hợp lệ; voice là lớp chính
  const platformFit = project.aspect_ratio === "9:16" ? 95 : 82;

  const overall = Math.round(
    sceneVoiceMatch * 0.25 +
      factConsistency * 0.18 +
      voiceQuality * 0.12 +
      musicDucking * 0.1 +
      captionSync * 0.12 +
      creative * 0.13 +
      platformFit * 0.1
  );

  const report: QualityReport = {
    id: variant.id,
    variant_id: variant.id,
    overall_score: overall,
    scene_voice_match: sceneVoiceMatch,
    fact_consistency: factConsistency,
    voice_quality: voiceQuality,
    music_ducking: musicDucking,
    caption_sync: captionSync,
    creative_difference: creative,
    platform_fit: platformFit,
    issues,
    created_at: nowISO(),
  };
  await store().upsert<QualityReport>("quality_reports", report);

  // Trạng thái nghỉ chỉ áp cho variant gốc; A/B không đụng status dự án.
  if (variant.is_master !== false) {
    if (project.auto) {
      // Batch: tự render bản cuối luôn.
      await store().update<Project>("projects", project.id, { status: "RENDERING_FINAL", updated_at: nowISO() });
      await enqueueChain(project.id, FINAL_PIPELINE, variant.id);
    } else {
      await store().update<Project>("projects", project.id, {
        status: "QUALITY_CHECK",
        updated_at: nowISO(),
      });
    }
  }
  await ctx.setProgress(1, `Điểm chất lượng ${overall}/100`);
}

function creativeDifference(variant: ContentVariant, analysis: SourceAnalysis | null): number {
  if (!analysis?.transcript) return 70;
  const a = tokenSet(variant.script);
  const b = tokenSet(analysis.transcript);
  const inter = [...a].filter((t) => b.has(t)).length;
  const union = new Set([...a, ...b]).size || 1;
  const jaccard = inter / union;
  return Math.round(clamp((1 - jaccard) * 120, 45, 96));
}

function tokenSet(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[.!?,]/g, "").split(/\s+/).filter((w) => w.length > 2)
  );
}
function avg(a: number[]): number {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
}
function pct(n: number): number {
  return Math.round(n * 100);
}
