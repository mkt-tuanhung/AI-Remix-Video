// ─────────────────────────────────────────────────────────────
// Kiểu dữ liệu lõi — bám theo đặc tả "AI Remix Video" mục 12 & 16.
// ─────────────────────────────────────────────────────────────

/** Trạng thái dự án — đặc tả 12.4 */
export type ProjectStatus =
  | "DRAFT"
  | "UPLOADED"
  | "ANALYZING"
  | "WAITING_FOR_TRANSCRIPT_APPROVAL"
  | "PLANNING_CONTENT"
  | "WAITING_FOR_SCRIPT_APPROVAL"
  | "BUILDING_STORYBOARD"
  | "GENERATING_ASSETS"
  | "GENERATING_VOICE"
  | "MIXING_AUDIO"
  | "BUILDING_TIMELINE"
  | "RENDERING_PREVIEW"
  | "WAITING_FOR_MEDIA_APPROVAL"
  | "QUALITY_CHECK"
  | "REGENERATING"
  | "RENDERING_FINAL"
  | "CREATING_VARIANTS"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

/** Mục tiêu nội dung — đặc tả 5.2 */
export type ContentGoal =
  | "remix"
  | "summarize"
  | "expand"
  | "explainer"
  | "news"
  | "story"
  | "review"
  | "sales"
  | "education";

export type Platform =
  | "tiktok"
  | "instagram_reels"
  | "youtube_shorts"
  | "facebook_reels"
  | "custom";

export type AspectRatio = "9:16" | "1:1" | "4:5" | "16:9";

export type AssetType =
  | "source_clip"
  | "stock_video"
  | "image"
  | "ai_visual"
  | "motion_graphic"
  | "audio";

// ── Job / hàng đợi — đặc tả 12.2 ─────────────────────────────
export type JobStep =
  | "INGEST"
  | "TRANSCRIBE"
  | "VISION_ANALYSIS"
  | "CONTENT_ANALYSIS"
  | "FACT_CHECK"
  | "SCRIPT_GENERATION"
  | "STORYBOARD"
  | "ASSET_SEARCH"
  | "VOICE_GENERATION"
  | "MUSIC_MIX"
  | "CAPTION_GENERATION"
  | "TIMELINE_BUILD"
  | "PREVIEW_RENDER"
  | "QUALITY_CHECK"
  | "FINAL_RENDER"
  | "VARIANT_GENERATION"
  | "EXPORT"
  // Module 2: Truyện → Phim
  | "STORY_SCRIPT"
  | "STORY_STORYBOARD"
  | "IMAGE_GENERATION"
  | "VIDEO_ANIMATION"
  | "ASSEMBLE_FILM";

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface Job {
  id: string;
  project_id: string;
  variant_id?: string | null;
  step: JobStep;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  depends_on: string[];
  progress: number; // 0..1
  message?: string;
  error?: string | null;
  cost_estimate?: number; // USD
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
}

// ── Source video ─────────────────────────────────────────────
export interface SourceVideo {
  id: string;
  project_id: string;
  filename: string;
  storage_path: string; // đường dẫn public/uploads hoặc supabase storage
  mime: string;
  size_bytes: number;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  has_audio: boolean | null;
  checksum: string;
  thumbnail_path?: string | null;
  created_at: string;
}

// ── Project — đặc tả 16.1 ────────────────────────────────────
export type ProjectKind = "remix" | "story";

/** Thể loại hình ảnh cho module Truyện → Phim (đặc tả module 2). */
export type StoryGenre =
  | "2d"
  | "3d"
  | "epic"
  | "papercut"
  | "handdrawn"
  | "watercolor"
  | "realistic";

export interface Project {
  id: string;
  user_id: string;
  title: string;
  kind?: ProjectKind; // "remix" (mặc định) | "story"
  story_text?: string; // nội dung/truyện đầu vào cho kind=story
  genre?: StoryGenre; // thể loại hình ảnh cho kind=story
  // kenburns=ảnh động nhẹ · fal=nhân vật chuyển động AI (tự động) · manual=tạo clip ở Veo/Flow rồi upload
  motion_engine?: "kenburns" | "fal" | "manual";
  source_video_id: string | null;
  goal: ContentGoal;
  language: string;
  target_platforms: Platform[];
  target_duration_seconds: number;
  aspect_ratio: AspectRatio;
  status: ProjectStatus;
  brand_preset_id?: string | null;
  rights_confirmed: boolean;
  output_language?: "en" | "vi"; // ngôn ngữ kịch bản + voice đầu ra (mặc định en)
  music_mode?: "none" | "ai_bed" | "custom"; // nhạc nền
  music_path?: string | null; // public url nếu custom
  auto?: boolean; // chế độ tự động qua mọi gate (batch)
  batch_id?: string | null;
  created_at: string;
  updated_at: string;
}

// ── Phân tích nguồn — đặc tả 16.2 ────────────────────────────
export interface Speaker {
  id: string;
  label: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  confidence?: number;
}

export interface Shot {
  shot_id: string;
  start_time: number;
  end_time: number;
  description: string;
  people: string[];
  objects: string[];
  visible_text: string[];
  logo_detected: boolean;
  quality_score: number;
  reuse_eligible: boolean;
  keyframe_path?: string | null;
}

export interface Entity {
  name: string;
  type: "person" | "place" | "brand" | "product" | "number" | "date" | "event" | "other";
}

export interface Fact {
  text: string;
  kind: "confirmed" | "opinion" | "inferred" | "uncertain" | "needs_check";
  locked: boolean; // không được tự ý thay đổi
}

export interface SourceAnalysis {
  id: string; // = project_id (1-1 với dự án)
  project_id: string;
  language: string;
  transcript: string;
  segments: TranscriptSegment[];
  speakers: Speaker[];
  shots: Shot[];
  entities: Entity[];
  facts: Fact[];
  uncertain_claims: string[];
  main_topic: string;
  source_hook: string;
  source_cta: string;
  conflicts: string[]; // lời và hình mâu thuẫn — đặc tả 8.5
  transcript_approved: boolean;
  created_at: string;
  updated_at: string;
}

// ── Chiến lược + hook — đặc tả 8.7 / 8.8 ─────────────────────
export interface ContentStrategy {
  id: string;
  angle: string;
  audience: string;
  emotion: string;
  pacing: "slow" | "medium" | "fast";
  recommended_duration_seconds: number;
  recommended_platform: Platform;
  rationale: string;
}

export interface Hook {
  id: string;
  type: "question" | "surprise" | "pain" | "result" | "climax";
  text: string;
  scores: {
    clarity: number;
    curiosity: number;
    relevance: number;
    retention_3s: number;
    honesty: number;
  };
}

// ── Content variant — đặc tả 16.3 ────────────────────────────
export interface StoryCharacter {
  name: string;
  description: string; // mô tả tạo hình cố định
}

export interface DialogueLine {
  speaker: string; // "Narrator" hoặc tên nhân vật
  text: string;
}

export interface ContentVariant {
  id: string;
  project_id: string;
  characters?: StoryCharacter[]; // dàn nhân vật (phim truyện)
  platform: Platform;
  target_duration_seconds: number;
  content_angle: string;
  hook: string;
  script: string;
  cta: string;
  voice_style?: "expert" | "story" | "news" | "sales" | "friendly";
  label?: string; // nhãn A/B (vd "Hook câu hỏi + giọng chuyên gia")
  is_master?: boolean;
  status: "DRAFT" | "READY" | "RENDERED";
  created_at: string;
}

// ── Scene — đặc tả 16.4 ──────────────────────────────────────
export interface Scene {
  id: string;
  variant_id: string;
  order: number;
  narration: string;
  purpose: string;
  visual_intent: string;
  image_prompt?: string; // prompt sinh ảnh AI (module Truyện → Phim)
  veo_prompt?: string; // prompt sẵn để dán vào Veo/Flow (có thoại + SFX + chuyển động)
  dialogue?: DialogueLine[]; // lời thoại của cảnh (nhiều nhân vật)
  image_url?: string; // ảnh gốc (keyframe) — public url
  clip_url?: string; // clip user tải lên (Veo/Flow) — public url
  asset_type: AssetType;
  asset_id: string | null;
  search_queries: string[];
  start_time: number;
  end_time: number;
  on_screen_text: string;
  effect: string;
  transition: string;
  priority: "low" | "medium" | "high";
  scene_voice_match_score: number | null;
}

// ── Asset — đặc tả 16.5 ──────────────────────────────────────
export interface Asset {
  id: string;
  project_id: string;
  type: AssetType;
  source_url: string;
  source_page_url: string;
  provider: string;
  license: string; // "unknown" nếu không rõ
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  has_logo: boolean;
  quality_score: number;
  relevance_score: number;
  crop: unknown | null;
  local_path?: string | null; // public url sau khi tải về đĩa để render
}

// ── Audio mix — đặc tả 16.6 ──────────────────────────────────
export interface AudioMix {
  id: string; // = variant_id
  variant_id: string;
  voice_asset_id: string | null;
  music_asset_id: string | null;
  voice_gain_db: number;
  music_gain_db: number;
  ducking_enabled: boolean;
  ducking_reduction_db: number;
  attack_ms: number;
  release_ms: number;
}

// ── Quality report — đặc tả 16.7 ─────────────────────────────
export interface QualityIssue {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  timestamp?: number;
  scene_id?: string;
}

export interface QualityReport {
  id: string; // = variant_id
  variant_id: string;
  overall_score: number;
  scene_voice_match: number;
  fact_consistency: number;
  voice_quality: number;
  music_ducking: number;
  caption_sync: number;
  creative_difference: number;
  platform_fit: number;
  issues: QualityIssue[];
  created_at: string;
}

// ── Render output — kết quả voice/phụ đề/video (id = variant_id) ──
export interface RenderOutput {
  id: string; // = variant_id
  variant_id: string;
  project_id: string;
  voice_provider: string;
  voice_path: string | null; // public url (voice thuần)
  audio_path: string | null; // public url (voice + nhạc đã ducking); null => dùng voice_path
  music_mode: "none" | "ai_bed" | "custom";
  duration: number;
  srt_path: string | null;
  vtt_path: string | null;
  preview_path: string | null;
  final_path: string | null;
  updated_at: string;
}

// ── Brand preset — đặc tả 5.4 ────────────────────────────────
export interface Batch {
  id: string;
  user_id: string;
  status: "processing" | "completed";
  project_ids: string[];
  created_at: string;
}

export interface BrandPreset {
  id: string;
  user_id: string;
  name: string;
  logo_url?: string;
  font?: string;
  colors?: string[];
  intro_url?: string;
  outro_url?: string;
  banned_words?: string[];
}
