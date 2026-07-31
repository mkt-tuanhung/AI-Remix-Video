import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  attachSourceVideo,
  createBatchRecord,
  createProject,
  listBatches,
  setBatchProjects,
  startAnalysis,
} from "@/lib/services";
import { projectDir } from "@/lib/paths";
import { sha256 } from "@/lib/util";
import type { AspectRatio, ContentGoal, Platform } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ALLOWED = new Set(["video/mp4", "video/quicktime", "video/x-m4v", "video/webm"]);

export async function GET() {
  return NextResponse.json({ batches: await listBatches() });
}

// Tạo batch: nhiều video + cấu hình chung → mỗi video 1 dự án chạy tự động (auto).
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length) return NextResponse.json({ error: "Chưa chọn video" }, { status: 400 });
    if (form.get("rights_confirmed") !== "true") {
      return NextResponse.json({ error: "Cần xác nhận quyền sử dụng video nguồn" }, { status: 400 });
    }

    const goal = (form.get("goal") as ContentGoal) || "remix";
    const platform = (form.get("platform") as Platform) || "tiktok";
    const duration = Number(form.get("duration") || 45);
    const ratio = (form.get("aspect_ratio") as AspectRatio) || "9:16";
    const music = (form.get("music_mode") as "none" | "ai_bed") || "ai_bed";
    const lang = (form.get("output_language") as "en" | "vi") || "en";

    const batch = await createBatchRecord();
    const projectIds: string[] = [];

    for (const file of files) {
      if (file.type && !ALLOWED.has(file.type)) continue;
      const project = await createProject({
        title: file.name.replace(/\.[^.]+$/, "").slice(0, 60) || "Batch video",
        goal,
        target_platforms: [platform],
        target_duration_seconds: duration,
        aspect_ratio: ratio,
        output_language: lang,
        music_mode: music,
        auto: true,
        batch_id: batch.id,
        rights_confirmed: true,
      });

      const buf = Buffer.from(await file.arrayBuffer());
      const ext = path.extname(file.name) || ".mp4";
      const dir = projectDir(project.id);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, `source${ext}`), buf);
      await attachSourceVideo(project.id, {
        filename: file.name,
        storage_path: `/uploads/${project.id}/source${ext}`,
        mime: file.type || "video/mp4",
        size_bytes: buf.length,
        duration_seconds: null,
        width: null,
        height: null,
        fps: null,
        has_audio: null,
        checksum: sha256(buf),
        thumbnail_path: null,
      });
      projectIds.push(project.id);
    }

    await setBatchProjects(batch.id, projectIds);
    // Khởi động phân tích cho từng dự án (auto sẽ tự chạy hết dây chuyền).
    for (const pid of projectIds) await startAnalysis(pid);

    return NextResponse.json({ batch: { ...batch, project_ids: projectIds } }, { status: 202 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
