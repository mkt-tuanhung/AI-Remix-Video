import { NextResponse } from "next/server";
import { approveScript } from "@/lib/services";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Gate 2 — duyệt kịch bản → dựng storyboard + tìm tài nguyên.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const jobs = await approveScript(params.id);
    return NextResponse.json({ jobs }, { status: 202 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
