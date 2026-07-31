import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { attachSourceVideo, getProject } from "@/lib/services";
import { projectDir } from "@/lib/paths";
import { sha256 } from "@/lib/util";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED = new Set(["video/mp4", "video/quicktime", "video/x-m4v", "video/webm"]);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const project = await getProject(params.id);
    if (!project) return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Thiếu file video" }, { status: 400 });
    }
    if (file.type && !ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: `Định dạng không hỗ trợ: ${file.type}. Dùng MP4/MOV/M4V/WebM.` },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name) || ".mp4";
    const dir = projectDir(project.id);
    await fs.mkdir(dir, { recursive: true });
    const filename = `source${ext}`;
    await fs.writeFile(path.join(dir, filename), buf);

    const video = await attachSourceVideo(project.id, {
      filename: file.name,
      storage_path: `/uploads/${project.id}/${filename}`,
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

    return NextResponse.json({ video }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
