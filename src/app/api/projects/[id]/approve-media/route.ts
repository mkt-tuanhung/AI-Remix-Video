import { NextResponse } from "next/server";
import { approveMedia } from "@/lib/services";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Gate 3 — duyệt storyboard/tài nguyên → sản xuất voice/phụ đề/render nháp.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const jobs = await approveMedia(params.id);
    return NextResponse.json({ jobs }, { status: 202 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
