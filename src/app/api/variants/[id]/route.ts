import { NextResponse } from "next/server";
import { updateVariant } from "@/lib/services";

export const dynamic = "force-dynamic";

// PATCH kịch bản / CTA / hook của variant (Gate 2).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const patch: Record<string, string> = {};
    for (const k of ["script", "cta", "hook", "content_angle"]) {
      if (typeof body[k] === "string") patch[k] = body[k];
    }
    const variant = await updateVariant(params.id, patch);
    return NextResponse.json({ variant });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
