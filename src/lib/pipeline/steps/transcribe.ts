import path from "node:path";
import type { StepContext } from "../context";
import { store } from "../../store";
import type { Project, SourceAnalysis, SourceVideo } from "../../types";
import { runTranscription } from "../../providers/transcription";
import { mediaAbs } from "../../paths";
import { nowISO } from "../../util";

// TRANSCRIBE — đặc tả 8.3: speech-to-text có timestamp.
export async function transcribe(ctx: StepContext): Promise<void> {
  const { project } = ctx;
  const video = await store().get<SourceVideo>("source_videos", project.source_video_id!);
  if (!video) throw new Error("Không tìm thấy video nguồn");

  await ctx.setProgress(0.2, "Đang nhận dạng lời nói");
  const absVideo = mediaAbs(video.storage_path);
  const result = await runTranscription(absVideo, project.id);

  await ctx.setProgress(0.8, `Transcript (${result.provider})`);
  const existing = await store().get<SourceAnalysis>("source_analyses", project.id);
  const base: SourceAnalysis = existing ?? emptyAnalysis(project.id);

  await store().upsert<SourceAnalysis>("source_analyses", {
    ...base,
    language: result.language,
    transcript: result.transcript,
    segments: result.segments,
    speakers: [{ id: "spk_1", label: "Người nói 1" }],
    updated_at: nowISO(),
  });

  await ctx.setProgress(1, `Đã tạo transcript bằng ${result.provider}`);
}

export function emptyAnalysis(projectId: string): SourceAnalysis {
  return {
    id: projectId,
    project_id: projectId,
    language: "vi",
    transcript: "",
    segments: [],
    speakers: [],
    shots: [],
    entities: [],
    facts: [],
    uncertain_claims: [],
    main_topic: "",
    source_hook: "",
    source_cta: "",
    conflicts: [],
    transcript_approved: false,
    created_at: nowISO(),
    updated_at: nowISO(),
  };
}
