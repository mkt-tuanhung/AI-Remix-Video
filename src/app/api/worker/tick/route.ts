import { NextResponse } from "next/server";
import { drainQueue } from "@/lib/orchestrator/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Đảm bảo hàng đợi được xử lý ngay cả khi tiến trình bị khởi động lại giữa chừng.
// UI poll endpoint này trong lúc dự án đang chạy.
export async function POST() {
  await drainQueue();
  return NextResponse.json({ ok: true });
}
