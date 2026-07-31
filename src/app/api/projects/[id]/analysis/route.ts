import { NextResponse } from "next/server";
import { getAnalysis, updateTranscript } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const analysis = await getAnalysis(params.id);
  if (!analysis) return NextResponse.json({ error: "Chưa có phân tích" }, { status: 404 });
  return NextResponse.json({ analysis });
}

// PATCH transcript (Gate 1) — đặc tả 13.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const analysis = await updateTranscript(
      params.id,
      body.transcript ?? "",
      !!body.approved
    );
    return NextResponse.json({ analysis });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
