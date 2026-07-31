import { store } from "../store";
import type { ContentVariant, Job, Project } from "../types";

export interface StepContext {
  job: Job;
  project: Project;
  /** Cập nhật tiến độ + thông điệp của job (0..1). */
  setProgress: (progress: number, message?: string) => Promise<void>;
}

/** Variant mà job đang thao tác: job.variant_id nếu có (A/B), ngược lại variant gốc (cũ nhất). */
export async function resolveVariant(ctx: StepContext): Promise<ContentVariant> {
  if (ctx.job.variant_id) {
    const v = await store().get<ContentVariant>("variants", ctx.job.variant_id);
    if (v) return v;
  }
  const list = await store().list<ContentVariant>("variants", { project_id: ctx.project.id } as Partial<ContentVariant>);
  if (!list.length) throw new Error("Chưa có variant");
  return list.sort((a, b) => (a.created_at < b.created_at ? -1 : 1))[0];
}

export type StepHandler = (ctx: StepContext) => Promise<void>;

export async function makeContext(job: Job): Promise<StepContext> {
  const project = await store().get<Project>("projects", job.project_id);
  if (!project) throw new Error(`Project ${job.project_id} không tồn tại`);
  return {
    job,
    project,
    setProgress: async (progress, message) => {
      await store().update<Job>("jobs", job.id, { progress, message });
    },
  };
}
