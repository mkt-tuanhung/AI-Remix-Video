import type { JobStep } from "../types";
import type { StepHandler } from "./context";
import { ingest } from "./steps/ingest";
import { transcribe } from "./steps/transcribe";
import { visionAnalysis } from "./steps/vision";
import { contentAnalysis } from "./steps/content-analysis";
import { scriptGeneration } from "./steps/script-generation";
import { storyboard } from "./steps/storyboard";
import { assetSearch } from "./steps/asset-search";
import { voiceGeneration } from "./steps/voice-generation";
import { musicMix } from "./steps/music-mix";
import { captionGeneration } from "./steps/caption-generation";
import { previewRender } from "./steps/preview-render";
import { qualityCheck } from "./steps/quality-check";
import { finalRender } from "./steps/final-render";
import { storyScript } from "./steps/story-script";
import { storyStoryboard } from "./steps/story-storyboard";
import { imageGeneration } from "./steps/image-generation";
import { videoAnimation } from "./steps/video-animation";

// Registry bước -> handler.
// GĐ1: 4 bước phân tích. GĐ2: chiến lược/hook/kịch bản → storyboard → tài nguyên.
// Các bước render (VOICE_GENERATION, MUSIC_MIX, ...) sẽ cắm dần vào đây.
export const HANDLERS: Partial<Record<JobStep, StepHandler>> = {
  INGEST: ingest,
  TRANSCRIBE: transcribe,
  VISION_ANALYSIS: visionAnalysis,
  CONTENT_ANALYSIS: contentAnalysis,
  SCRIPT_GENERATION: scriptGeneration,
  STORYBOARD: storyboard,
  ASSET_SEARCH: assetSearch,
  VOICE_GENERATION: voiceGeneration,
  MUSIC_MIX: musicMix,
  CAPTION_GENERATION: captionGeneration,
  PREVIEW_RENDER: previewRender,
  QUALITY_CHECK: qualityCheck,
  FINAL_RENDER: finalRender,
  STORY_SCRIPT: storyScript,
  STORY_STORYBOARD: storyStoryboard,
  IMAGE_GENERATION: imageGeneration,
  VIDEO_ANIMATION: videoAnimation,
};

/** Chuỗi job của giai đoạn phân tích (chạy tuần tự theo depends_on). */
export const ANALYSIS_PIPELINE: JobStep[] = [
  "INGEST",
  "TRANSCRIBE",
  "VISION_ANALYSIS",
  "CONTENT_ANALYSIS",
];

/** Sau khi duyệt transcript (Gate 1): sinh chiến lược/hook/kịch bản. */
export const SCRIPT_PIPELINE: JobStep[] = ["SCRIPT_GENERATION"];

/** Sau khi duyệt kịch bản (Gate 2): dựng storyboard + tìm tài nguyên. */
export const STORYBOARD_PIPELINE: JobStep[] = ["STORYBOARD", "ASSET_SEARCH"];

/** Sau khi duyệt media (Gate 3): voice → phụ đề → render nháp → kiểm định. */
export const PRODUCTION_PIPELINE: JobStep[] = [
  "VOICE_GENERATION",
  "MUSIC_MIX",
  "CAPTION_GENERATION",
  "PREVIEW_RENDER",
  "QUALITY_CHECK",
];

/** Sau khi duyệt bản nháp (Gate 4/5): render bản cuối chất lượng cao. */
export const FINAL_PIPELINE: JobStep[] = ["FINAL_RENDER"];

/** Module 2 — Truyện → Phim: chạy trọn gói tự động từ 1 nội dung. */
export const STORY_PIPELINE: JobStep[] = [
  "STORY_SCRIPT",
  "STORY_STORYBOARD",
  "IMAGE_GENERATION",
  "VIDEO_ANIMATION",
  "VOICE_GENERATION",
  "MUSIC_MIX",
  "CAPTION_GENERATION",
  "PREVIEW_RENDER",
  "QUALITY_CHECK",
  "FINAL_RENDER",
];

/** Một phiên bản A/B: sản xuất trọn gói + render bản cuối luôn. */
export const VARIANT_PIPELINE: JobStep[] = [
  "VOICE_GENERATION",
  "MUSIC_MIX",
  "CAPTION_GENERATION",
  "PREVIEW_RENDER",
  "QUALITY_CHECK",
  "FINAL_RENDER",
];
