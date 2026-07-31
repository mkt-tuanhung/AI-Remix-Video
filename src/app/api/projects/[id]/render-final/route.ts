import { NextResponse } from "next/server";
import { renderFinal } from "@/lib/services";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Gate 4/5 — render bản cuối chất lượng cao.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const jobs = await renderFinal(params.id);
    return NextResponse.json({ jobs }, { status: 202 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
