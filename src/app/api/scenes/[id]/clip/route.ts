import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { store } from "@/lib/store";
import type { ContentVariant, Scene } from "@/lib/types";
import { uploadSceneClip } from "@/lib/services";
import { projectDir } from "@/lib/paths";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ALLOWED = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"]);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const scene = await store().get<Scene>("scenes", params.id);
    if (!scene) return NextResponse.json({ error: "Không tìm thấy cảnh" }, { status: 404 });
    const variant = await store().get<ContentVariant>("variants", scene.variant_id);
    if (!variant) return NextResponse.json({ error: "Không tìm thấy variant" }, { status: 404 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Thiếu file clip" }, { status: 400 });
    if (file.type && !ALLOWED.has(file.type)) {
      return NextResponse.json({ error: `Định dạng không hỗ trợ: ${file.type}` }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name) || ".mp4";
    const dir = path.join(projectDir(variant.project_id), "clips");
    await fs.mkdir(dir, { recursive: true });
    const filename = `${scene.id}${ext}`;
    await fs.writeFile(path.join(dir, filename), buf);

    const updated = await uploadSceneClip(scene.id, {
      local_path: `/uploads/${variant.project_id}/clips/${filename}`,
      mime: file.type || "video/mp4",
      size_bytes: buf.length,
      width: null,
      height: null,
    });
    return NextResponse.json({ scene: updated }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
