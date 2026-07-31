import { NextResponse } from "next/server";
import { createStoryProject } from "@/lib/services";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Tạo phim từ truyện/nội dung — chạy tự động toàn bộ.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const project = await createStoryProject({
      title: body.title,
      story_text: body.story_text,
      genre: body.genre,
      output_language: body.output_language,
      target_duration_seconds: body.target_duration_seconds,
      aspect_ratio: body.aspect_ratio,
      platform: body.platform,
      music_mode: body.music_mode,
      motion_engine: body.motion_engine,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
