import { store } from "./store";
import type {
  AspectRatio,
  ContentGoal,
  Job,
  Platform,
  Project,
  SourceAnalysis,
  SourceVideo,
} from "./types";
import { nowISO, uid } from "./util";
import { enqueueChain } from "./orchestrator/queue";
import {
  ANALYSIS_PIPELINE,
  SCRIPT_PIPELINE,
  STORYBOARD_PIPELINE,
  PRODUCTION_PIPELINE,
  FINAL_PIPELINE,
  VARIANT_PIPELINE,
  STORY_PIPELINE,
} from "./pipeline/registry";
import { kickWorker } from "./orchestrator/worker";
import type {
  Asset,
  Batch,
  ContentStrategy,
  ContentVariant,
  Hook,
  QualityReport,
  RenderOutput,
  Scene,
} from "./types";
import type { StrategyDoc, HookDoc } from "./pipeline/steps/script-generation";

// User demo cố định (chưa gắn auth trong giai đoạn nền móng).
export const DEMO_USER = "demo-user";

export interface CreateProjectInput {
  title: string;
  goal?: ContentGoal;
  language?: string;
  target_platforms?: Platform[];
  target_duration_seconds?: number;
  aspect_ratio?: AspectRatio;
  output_language?: "en" | "vi";
  music_mode?: "none" | "ai_bed" | "custom";
  auto?: boolean;
  batch_id?: string | null;
  rights_confirmed: boolean;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  if (!input.rights_confirmed) {
    throw new Error("Cần xác nhận quyền sử dụng video nguồn (đặc tả mục 23).");
  }
  const project: Project = {
    id: uid("proj"),
    user_id: DEMO_USER,
    title: input.title?.trim() || "Dự án chưa đặt tên",
    source_video_id: null,
    goal: input.goal ?? "remix",
    language: input.language ?? "vi",
    target_platforms: input.target_platforms?.length ? input.target_platforms : ["tiktok"],
    target_duration_seconds: input.target_duration_seconds ?? 60,
    aspect_ratio: input.aspect_ratio ?? "9:16",
    status: "DRAFT",
    brand_preset_id: null,
    rights_confirmed: true,
    output_language: input.output_language ?? "en",
    music_mode: input.music_mode ?? "ai_bed",
    music_path: null,
    auto: input.auto ?? false,
    batch_id: input.batch_id ?? null,
    created_at: nowISO(),
    updated_at: nowISO(),
  };
  return store().insert<Project>("projects", project);
}

export async function listProjects(): Promise<Project[]> {
  const rows = await store().list<Project>("projects", { user_id: DEMO_USER } as Partial<Project>);
  return rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function getProject(id: string): Promise<Project | null> {
  return store().get<Project>("projects", id);
}

export async function attachSourceVideo(
  projectId: string,
  video: Omit<SourceVideo, "id" | "project_id" | "created_at">
): Promise<SourceVideo> {
  const project = await getProject(projectId);
  if (!project) throw new Error("Không tìm thấy dự án");
  const record: SourceVideo = {
    id: uid("vid"),
    project_id: projectId,
    created_at: nowISO(),
    ...video,
  };
  await store().insert<SourceVideo>("source_videos", record);
  await store().update<Project>("projects", projectId, {
    source_video_id: record.id,
    status: "UPLOADED",
    updated_at: nowISO(),
  });
  return record;
}

export async function startAnalysis(projectId: string): Promise<Job[]> {
  const project = await getProject(projectId);
  if (!project) throw new Error("Không tìm thấy dự án");
  if (!project.source_video_id) throw new Error("Dự án chưa có video nguồn");

  // Không tạo trùng nếu đã có job phân tích đang chạy/chờ.
  const existing = await store().list<Job>("jobs", { project_id: projectId } as Partial<Job>);
  const active = existing.filter((j) => j.status === "pending" || j.status === "running");
  if (active.length) return active;

  const jobs = await enqueueChain(projectId, ANALYSIS_PIPELINE);
  await store().update<Project>("projects", projectId, {
    status: "ANALYZING",
    updated_at: nowISO(),
  });
  kickWorker();
  return jobs;
}

export async function getAnalysis(projectId: string): Promise<SourceAnalysis | null> {
  return store().get<SourceAnalysis>("source_analyses", projectId);
}

export async function getSourceVideo(project: Project): Promise<SourceVideo | null> {
  if (!project.source_video_id) return null;
  return store().get<SourceVideo>("source_videos", project.source_video_id);
}

export async function listJobs(projectId: string): Promise<Job[]> {
  const rows = await store().list<Job>("jobs", { project_id: projectId } as Partial<Job>);
  return rows.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
}

export async function updateTranscript(
  projectId: string,
  transcript: string,
  approved: boolean
): Promise<SourceAnalysis> {
  const existing = await getAnalysis(projectId);
  if (!existing) throw new Error("Chưa có bản phân tích để cập nhật");
  const updated = await store().upsert<SourceAnalysis>("source_analyses", {
    ...existing,
    transcript,
    transcript_approved: approved,
    updated_at: nowISO(),
  });
  if (approved) {
    await store().update<Project>("projects", projectId, {
      status: "PLANNING_CONTENT",
      updated_at: nowISO(),
    });
    // Gate 1 xong → sinh chiến lược / hook / kịch bản.
    const active = await hasActiveJobs(projectId);
    if (!active) {
      await enqueueChain(projectId, SCRIPT_PIPELINE);
      kickWorker();
    }
  }
  return updated;
}

async function hasActiveJobs(projectId: string): Promise<boolean> {
  const jobs = await store().list<Job>("jobs", { project_id: projectId } as Partial<Job>);
  return jobs.some((j) => j.status === "pending" || j.status === "running");
}

// ── Giai đoạn kịch bản / storyboard ─────────────────────────
export async function getStrategies(projectId: string): Promise<ContentStrategy[]> {
  const doc = await store().get<StrategyDoc>("content_strategies", projectId);
  return doc?.items ?? [];
}

export async function getHooks(projectId: string): Promise<Hook[]> {
  const doc = await store().get<HookDoc>("hooks", projectId);
  return doc?.items ?? [];
}

export async function getVariants(projectId: string): Promise<ContentVariant[]> {
  return store().list<ContentVariant>("variants", { project_id: projectId } as Partial<ContentVariant>);
}

export async function getPrimaryVariant(projectId: string): Promise<ContentVariant | null> {
  const list = await getVariants(projectId);
  if (!list.length) return null;
  return [...list].sort((a, b) => (a.created_at < b.created_at ? -1 : 1))[0];
}

export async function getScenes(variantId: string): Promise<Scene[]> {
  const list = await store().list<Scene>("scenes", { variant_id: variantId } as Partial<Scene>);
  return list.sort((a, b) => a.order - b.order);
}

export async function getAssetsMap(projectId: string): Promise<Record<string, Asset>> {
  const list = await store().list<Asset>("assets", { project_id: projectId } as Partial<Asset>);
  return Object.fromEntries(list.map((a) => [a.id, a]));
}

/** Sửa kịch bản/CTA/hook của variant (Gate 2). */
export async function updateVariant(
  variantId: string,
  patch: Partial<Pick<ContentVariant, "script" | "cta" | "hook" | "content_angle">>
): Promise<ContentVariant> {
  return store().update<ContentVariant>("variants", variantId, patch);
}

/** Duyệt kịch bản (Gate 2) → dựng storyboard + tìm tài nguyên. */
export async function approveScript(projectId: string): Promise<Job[]> {
  const project = await getProject(projectId);
  if (!project) throw new Error("Không tìm thấy dự án");
  if (await hasActiveJobs(projectId)) {
    return (await store().list<Job>("jobs", { project_id: projectId } as Partial<Job>)).filter(
      (j) => j.status === "pending" || j.status === "running"
    );
  }
  const jobs = await enqueueChain(projectId, STORYBOARD_PIPELINE);
  await store().update<Project>("projects", projectId, {
    status: "BUILDING_STORYBOARD",
    updated_at: nowISO(),
  });
  kickWorker();
  return jobs;
}

/** Gate 3 — duyệt media → sản xuất: voice → phụ đề → render nháp → kiểm định. */
export async function approveMedia(projectId: string): Promise<Job[]> {
  const project = await getProject(projectId);
  if (!project) throw new Error("Không tìm thấy dự án");
  if (await hasActiveJobs(projectId)) {
    return (await store().list<Job>("jobs", { project_id: projectId } as Partial<Job>)).filter(
      (j) => j.status === "pending" || j.status === "running"
    );
  }
  const jobs = await enqueueChain(projectId, PRODUCTION_PIPELINE);
  await store().update<Project>("projects", projectId, {
    status: "GENERATING_VOICE",
    updated_at: nowISO(),
  });
  kickWorker();
  return jobs;
}

/** Gate 4/5 — duyệt bản nháp → render bản cuối. */
export async function renderFinal(projectId: string): Promise<Job[]> {
  const project = await getProject(projectId);
  if (!project) throw new Error("Không tìm thấy dự án");
  if (await hasActiveJobs(projectId)) {
    return (await store().list<Job>("jobs", { project_id: projectId } as Partial<Job>)).filter(
      (j) => j.status === "pending" || j.status === "running"
    );
  }
  const jobs = await enqueueChain(projectId, FINAL_PIPELINE);
  await store().update<Project>("projects", projectId, {
    status: "RENDERING_FINAL",
    updated_at: nowISO(),
  });
  kickWorker();
  return jobs;
}

export async function getRender(variantId: string): Promise<RenderOutput | null> {
  return store().get<RenderOutput>("renders", variantId);
}

export async function getQuality(variantId: string): Promise<QualityReport | null> {
  return store().get<QualityReport>("quality_reports", variantId);
}

export interface PlanningBundle {
  strategies: ContentStrategy[];
  hooks: Hook[];
  variant: ContentVariant | null; // master
  scenes: Scene[];
  assets: Record<string, Asset>;
  render: RenderOutput | null; // master
  quality: QualityReport | null; // master
  variants: ContentVariant[]; // tất cả (master + A/B)
  renders: Record<string, RenderOutput>; // theo variant_id
  qualities: Record<string, QualityReport>; // theo variant_id
}

export async function getPlanning(projectId: string): Promise<PlanningBundle> {
  const [strategies, hooks, variant, assets, variants] = await Promise.all([
    getStrategies(projectId),
    getHooks(projectId),
    getPrimaryVariant(projectId),
    getAssetsMap(projectId),
    getVariants(projectId),
  ]);
  const scenes = variant ? await getScenes(variant.id) : [];
  const render = variant ? await getRender(variant.id) : null;
  const quality = variant ? await getQuality(variant.id) : null;

  const renders: Record<string, RenderOutput> = {};
  const qualities: Record<string, QualityReport> = {};
  await Promise.all(
    variants.map(async (v) => {
      const [r, q] = await Promise.all([getRender(v.id), getQuality(v.id)]);
      if (r) renders[v.id] = r;
      if (q) qualities[v.id] = q;
    })
  );

  return { strategies, hooks, variant, scenes, assets, render, quality, variants, renders, qualities };
}

// ── A/B variants ─────────────────────────────────────────────
export interface CreateVariantInput {
  hookId?: string;
  voiceStyle?: "expert" | "story" | "news" | "sales" | "friendly";
  cta?: string;
  label?: string;
}

const VOICE_STYLE_LABEL: Record<string, string> = {
  expert: "giọng chuyên gia",
  story: "giọng kể chuyện",
  news: "giọng tin tức",
  sales: "giọng bán hàng",
  friendly: "giọng gần gũi",
};

/** Tạo một phiên bản A/B từ master: đổi hook / voice / CTA, rồi sản xuất + render. */
export async function createABVariant(
  projectId: string,
  input: CreateVariantInput
): Promise<{ variant: ContentVariant; jobs: Job[] }> {
  const master = await getPrimaryVariant(projectId);
  if (!master) throw new Error("Chưa có bản gốc để tạo phiên bản");
  const scenes = await getScenes(master.id);
  if (!scenes.length) throw new Error("Bản gốc chưa có storyboard");

  const hooks = await getHooks(projectId);
  const chosenHook = input.hookId ? hooks.find((h) => h.id === input.hookId) : null;
  const newHook = chosenHook?.text ?? master.hook;
  const newCta = input.cta?.trim() || master.cta;

  const parts: string[] = [];
  if (chosenHook) parts.push("hook mới");
  if (input.voiceStyle) parts.push(VOICE_STYLE_LABEL[input.voiceStyle]);
  if (input.cta) parts.push("CTA mới");
  const label = input.label || (parts.length ? parts.join(" + ") : "Phiên bản A/B");

  const vid = uid("var");
  const variant: ContentVariant = {
    ...master,
    id: vid,
    hook: newHook,
    cta: newCta,
    voice_style: input.voiceStyle ?? master.voice_style,
    label,
    is_master: false,
    status: "DRAFT",
    created_at: nowISO(),
  };
  await store().insert<ContentVariant>("variants", variant);

  // Copy scene; thay lời cảnh đầu bằng hook mới, cảnh cuối bằng CTA mới.
  const sorted = [...scenes].sort((a, b) => a.order - b.order);
  const lastOrder = sorted[sorted.length - 1]?.order;
  for (const s of sorted) {
    const copy: Scene = { ...s, id: uid("scene"), variant_id: vid };
    if (s.order === 0 && chosenHook) copy.narration = newHook;
    if (s.order === lastOrder && input.cta) copy.narration = newCta;
    copy.scene_voice_match_score = null;
    await store().insert<Scene>("scenes", copy);
  }

  const jobs = await enqueueChain(projectId, VARIANT_PIPELINE, vid);
  kickWorker();
  return { variant, jobs };
}

// ── Module 2: Truyện → Phim ─────────────────────────────────
export interface CreateStoryInput {
  title?: string;
  story_text: string;
  genre?: import("./types").StoryGenre;
  output_language?: "en" | "vi";
  target_duration_seconds?: number;
  aspect_ratio?: AspectRatio;
  platform?: Platform;
  music_mode?: "none" | "ai_bed";
  motion_engine?: "kenburns" | "fal";
}

export async function createStoryProject(input: CreateStoryInput): Promise<Project> {
  if (!input.story_text?.trim()) throw new Error("Cần nhập nội dung/truyện");
  const project: Project = {
    id: uid("proj"),
    user_id: DEMO_USER,
    title: input.title?.trim() || "Phim từ truyện",
    kind: "story",
    story_text: input.story_text.trim(),
    genre: input.genre ?? "2d",
    motion_engine: input.motion_engine ?? "kenburns",
    source_video_id: null,
    goal: "story",
    language: input.output_language ?? "en",
    target_platforms: [input.platform ?? "youtube_shorts"],
    target_duration_seconds: input.target_duration_seconds ?? 45,
    aspect_ratio: input.aspect_ratio ?? "9:16",
    status: "PLANNING_CONTENT",
    brand_preset_id: null,
    rights_confirmed: true,
    output_language: input.output_language ?? "en",
    music_mode: input.music_mode ?? "ai_bed",
    music_path: null,
    auto: false,
    batch_id: null,
    created_at: nowISO(),
    updated_at: nowISO(),
  };
  await store().insert<Project>("projects", project);
  await enqueueChain(project.id, STORY_PIPELINE);
  kickWorker();
  return project;
}

// ── Batch (xử lý hàng loạt) ─────────────────────────────────
export async function createBatchRecord(): Promise<Batch> {
  const batch: Batch = {
    id: uid("batch"),
    user_id: DEMO_USER,
    status: "processing",
    project_ids: [],
    created_at: nowISO(),
  };
  return store().insert<Batch>("batches", batch);
}

export async function setBatchProjects(batchId: string, projectIds: string[]): Promise<void> {
  await store().update<Batch>("batches", batchId, { project_ids: projectIds });
}

export async function getBatch(id: string): Promise<{ batch: Batch; projects: Project[] } | null> {
  const batch = await store().get<Batch>("batches", id);
  if (!batch) return null;
  const projects: Project[] = [];
  for (const pid of batch.project_ids) {
    const p = await getProject(pid);
    if (p) projects.push(p);
  }
  // Cập nhật trạng thái batch nếu tất cả xong.
  const allDone = projects.length > 0 && projects.every((p) => p.status === "COMPLETED" || p.status === "FAILED");
  if (allDone && batch.status !== "completed") {
    await store().update<Batch>("batches", id, { status: "completed" });
    batch.status = "completed";
  }
  return { batch, projects };
}

export async function listBatches(): Promise<Batch[]> {
  const rows = await store().list<Batch>("batches", { user_id: DEMO_USER } as Partial<Batch>);
  return rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function getBatchRenderMap(projects: Project[]): Promise<Record<string, RenderOutput | null>> {
  const map: Record<string, RenderOutput | null> = {};
  await Promise.all(
    projects.map(async (p) => {
      const v = await getPrimaryVariant(p.id);
      map[p.id] = v ? await getRender(v.id) : null;
    })
  );
  return map;
}

export interface DashboardStats {
  total: number;
  processing: number;
  failed: number;
  completed: number;
  queuePending: number;
  queueRunning: number;
}

export async function dashboardStats(): Promise<DashboardStats> {
  const projects = await listProjects();
  const jobs = await store().list<Job>("jobs");
  const processingStatuses = new Set([
    "ANALYZING",
    "PLANNING_CONTENT",
    "BUILDING_STORYBOARD",
    "GENERATING_ASSETS",
    "GENERATING_VOICE",
    "MIXING_AUDIO",
    "BUILDING_TIMELINE",
    "RENDERING_PREVIEW",
    "QUALITY_CHECK",
    "REGENERATING",
    "RENDERING_FINAL",
    "CREATING_VARIANTS",
  ]);
  return {
    total: projects.length,
    processing: projects.filter((p) => processingStatuses.has(p.status)).length,
    failed: projects.filter((p) => p.status === "FAILED").length,
    completed: projects.filter((p) => p.status === "COMPLETED").length,
    queuePending: jobs.filter((j) => j.status === "pending").length,
    queueRunning: jobs.filter((j) => j.status === "running").length,
  };
}
