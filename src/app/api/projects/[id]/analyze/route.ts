import { NextResponse } from "next/server";
import { startAnalysis } from "@/lib/services";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const jobs = await startAnalysis(params.id);
    return NextResponse.json({ jobs }, { status: 202 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
