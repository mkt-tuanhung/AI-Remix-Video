import { NextResponse } from "next/server";
import { createABVariant } from "@/lib/services";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Tạo một phiên bản A/B (đổi hook / voice / CTA) và sản xuất + render.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const { variant, jobs } = await createABVariant(params.id, {
      hookId: body.hookId,
      voiceStyle: body.voiceStyle,
      cta: body.cta,
      label: body.label,
    });
    return NextResponse.json({ variant, jobs }, { status: 202 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
