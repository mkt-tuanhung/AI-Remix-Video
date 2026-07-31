import { NextResponse } from "next/server";
import { getBatch, getBatchRenderMap } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const data = await getBatch(params.id);
  if (!data) return NextResponse.json({ error: "Không tìm thấy batch" }, { status: 404 });
  const renders = await getBatchRenderMap(data.projects);
  return NextResponse.json({ ...data, renders });
}
