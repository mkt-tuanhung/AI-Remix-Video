import { store } from "../store";
import type { Job, Project } from "../types";
import { HANDLERS } from "../pipeline/registry";
import { makeContext } from "../pipeline/context";
import { nowISO } from "../util";

// Worker chạy trong process: rút cạn hàng đợi. An toàn khi gọi nhiều lần nhờ cờ khoá.
// Trong dev, mỗi lần enqueue ta gọi drainQueue() (fire-and-forget) để job tự chạy.

let draining = false;

function depsSatisfied(job: Job, all: Job[]): boolean {
  if (!job.depends_on.length) return true;
  return job.depends_on.every((id) => all.find((j) => j.id === id)?.status === "completed");
}

function depsFailed(job: Job, all: Job[]): boolean {
  return job.depends_on.some((id) => {
    const dep = all.find((j) => j.id === id);
    return dep?.status === "failed" || dep?.status === "cancelled";
  });
}

export async function drainQueue(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    // Vì chỉ có 1 drain chạy tại một thời điểm, mọi job "running" lúc này là
    // mồ côi (do lần drain trước bị dừng giữa chừng) → đưa lại pending để chạy lại.
    const stale = await store().list<Job>("jobs");
    for (const j of stale) {
      if (j.status === "running") {
        await store().update<Job>("jobs", j.id, { status: "pending", message: "Chạy lại sau gián đoạn" });
      }
    }

    // Lặp cho tới khi không còn job nào chạy được nữa.
    for (let guard = 0; guard < 1000; guard++) {
      const all = await store().list<Job>("jobs");
      const pending = all.filter((j) => j.status === "pending");
      if (!pending.length) break;

      // Huỷ job có dependency đã fail.
      const blocked = pending.filter((j) => depsFailed(j, all));
      for (const j of blocked) {
        await store().update<Job>("jobs", j.id, {
          status: "cancelled",
          message: "Bị huỷ do bước phụ thuộc lỗi",
          finished_at: nowISO(),
        });
      }

      const runnable = pending.filter((j) => !depsFailed(j, all) && depsSatisfied(j, all));
      if (!runnable.length) {
        // Còn pending nhưng chưa job nào đủ điều kiện (không nên xảy ra với chuỗi tuyến tính).
        if (blocked.length) continue;
        break;
      }

      // Chạy tuần tự 1 job mỗi vòng (đơn giản, tránh tranh chấp store filesystem).
      const job = runnable[0];
      await runJob(job.id);
    }
  } finally {
    draining = false;
  }
}

async function runJob(jobId: string): Promise<void> {
  const job = await store().get<Job>("jobs", jobId);
  if (!job || job.status !== "pending") return;

  const handler = HANDLERS[job.step];
  if (!handler) {
    await store().update<Job>("jobs", jobId, {
      status: "failed",
      error: `Chưa có handler cho bước ${job.step}`,
      finished_at: nowISO(),
    });
    return;
  }

  await store().update<Job>("jobs", jobId, {
    status: "running",
    attempts: job.attempts + 1,
    started_at: nowISO(),
    message: `Đang chạy ${job.step}`,
    error: null,
  });

  try {
    const running = await store().get<Job>("jobs", jobId);
    const ctx = await makeContext(running!);
    await handler(ctx);
    await store().update<Job>("jobs", jobId, {
      status: "completed",
      progress: 1,
      finished_at: nowISO(),
    });
  } catch (err: any) {
    const current = await store().get<Job>("jobs", jobId);
    const attempts = current?.attempts ?? 1;
    const msg = err?.message || String(err);
    if (attempts < (current?.max_attempts ?? 3)) {
      // Cho retry: đưa lại pending.
      await store().update<Job>("jobs", jobId, {
        status: "pending",
        message: `Lỗi, sẽ thử lại (${attempts}/${current?.max_attempts}): ${msg}`,
        error: msg,
      });
    } else {
      await store().update<Job>("jobs", jobId, {
        status: "failed",
        error: msg,
        message: `Thất bại sau ${attempts} lần: ${msg}`,
        finished_at: nowISO(),
      });
      // Đánh dấu dự án FAILED nếu là bước phân tích cốt lõi.
      await store().update<Project>("projects", job.project_id, {
        status: "FAILED",
        updated_at: nowISO(),
      }).catch(() => {});
    }
  }
}

/** Gọi drain nhưng không chặn caller (dùng trong route handler dev). */
export function kickWorker(): void {
  drainQueue().catch((e) => console.error("[worker] drain lỗi:", e?.message || e));
}
