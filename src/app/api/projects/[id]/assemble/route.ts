import { NextResponse } from "next/server";
import { assembleStoryFilm } from "@/lib/services";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Ghép phim từ các clip đã tải lên (chế độ Veo/Flow).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const jobs = await assembleStoryFilm(params.id, { captions: body.captions, music: body.music });
    return NextResponse.json({ jobs }, { status: 202 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
