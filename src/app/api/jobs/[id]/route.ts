import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import type { Job } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const job = await store().get<Job>("jobs", params.id);
  if (!job) return NextResponse.json({ error: "Không tìm thấy job" }, { status: 404 });
  return NextResponse.json({ job });
}
