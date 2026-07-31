import { store } from "../store";
import type { Job, JobStep } from "../types";
import { nowISO, uid } from "../util";

// Tạo job vào hàng đợi. depends_on = id các job phải xong trước (đặc tả 12.2).
export async function enqueueJob(params: {
  projectId: string;
  variantId?: string | null;
  step: JobStep;
  dependsOn?: string[];
  maxAttempts?: number;
}): Promise<Job> {
  const job: Job = {
    id: uid("job"),
    project_id: params.projectId,
    variant_id: params.variantId ?? null,
    step: params.step,
    status: "pending",
    attempts: 0,
    max_attempts: params.maxAttempts ?? 3,
    depends_on: params.dependsOn ?? [],
    progress: 0,
    message: "Đang chờ",
    error: null,
    cost_estimate: 0,
    created_at: nowISO(),
    started_at: null,
    finished_at: null,
  };
  return store().insert<Job>("jobs", job);
}

/** Tạo một chuỗi job tuần tự — mỗi job phụ thuộc job trước. */
export async function enqueueChain(
  projectId: string,
  steps: JobStep[],
  variantId?: string | null
): Promise<Job[]> {
  const jobs: Job[] = [];
  let prevId: string | null = null;
  for (const step of steps) {
    const job = await enqueueJob({
      projectId,
      variantId: variantId ?? null,
      step,
      dependsOn: prevId ? [prevId] : [],
    });
    jobs.push(job);
    prevId = job.id;
  }
  return jobs;
}
