import path from "node:path";
import type { StepContext } from "../context";
import { store } from "../../store";
import type { Project, SourceVideo } from "../../types";
import { probe, extractFrame } from "../../media/ffmpeg";
import { projectFramesDir, mediaAbs } from "../../paths";

// INGEST — đặc tả 8.1: kiểm tra, chuẩn hoá, đọc metadata, tạo thumbnail.
export async function ingest(ctx: StepContext): Promise<void> {
  const { project } = ctx;
  if (!project.source_video_id) throw new Error("Dự án chưa có video nguồn");

  const video = await store().get<SourceVideo>("source_videos", project.source_video_id);
  if (!video) throw new Error("Không tìm thấy bản ghi video nguồn");

  await ctx.setProgress(0.2, "Đọc metadata video");
  const absVideo = mediaAbs(video.storage_path);

  const meta = await probe(absVideo);
  const patch: Partial<SourceVideo> = {};
  if (meta) {
    patch.duration_seconds = meta.duration_seconds;
    patch.width = meta.width;
    patch.height = meta.height;
    patch.fps = meta.fps;
    patch.has_audio = meta.has_audio;
  } else {
    // Không có ffmpeg: giả định để pipeline vẫn chạy (mock).
    patch.duration_seconds = video.duration_seconds ?? 30;
    patch.has_audio = video.has_audio ?? true;
  }

  await ctx.setProgress(0.6, "Tạo ảnh đại diện");
  const thumbPath = path.join(projectFramesDir(project.id), "thumb.jpg");
  const thumb = await extractFrame(absVideo, 1, thumbPath);
  if (thumb) {
    patch.thumbnail_path = `/uploads/${project.id}/frames/thumb.jpg`;
  }

  await store().update<SourceVideo>("source_videos", video.id, patch);
  await store().update<Project>("projects", project.id, {
    status: "ANALYZING",
    updated_at: new Date().toISOString(),
  });
  await ctx.setProgress(1, "Đã tiếp nhận video");
}
