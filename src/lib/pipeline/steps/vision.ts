import path from "node:path";
import type { StepContext } from "../context";
import { store } from "../../store";
import type { SourceAnalysis, SourceVideo } from "../../types";
import { runVision } from "../../providers/vision";
import { projectFramesDir, mediaAbs } from "../../paths";
import { nowISO } from "../../util";
import { emptyAnalysis } from "./transcribe";

// VISION_ANALYSIS — đặc tả 8.4: tách shot, keyframe, nhận diện, chấm chất lượng.
export async function visionAnalysis(ctx: StepContext): Promise<void> {
  const { project } = ctx;
  const video = await store().get<SourceVideo>("source_videos", project.source_video_id!);
  if (!video) throw new Error("Không tìm thấy video nguồn");

  await ctx.setProgress(0.2, "Tách shot và lấy keyframe");
  const absVideo = mediaAbs(video.storage_path);

  const result = await runVision(
    absVideo,
    project.id,
    video.duration_seconds,
    projectFramesDir(project.id)
  );

  await ctx.setProgress(0.85, `Phân tích ${result.shots.length} cảnh (${result.provider})`);
  const existing = (await store().get<SourceAnalysis>("source_analyses", project.id)) ?? emptyAnalysis(project.id);
  await store().upsert<SourceAnalysis>("source_analyses", {
    ...existing,
    shots: result.shots,
    updated_at: nowISO(),
  });

  await ctx.setProgress(1, `Đã phân tích hình ảnh bằng ${result.provider}`);
}
