import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function sha256hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(req: Request) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return NextResponse.json({ ok: true }); // cổng tắt

  const body = await req.json().catch(() => ({}));
  if (typeof body.password !== "string" || body.password !== pw) {
    return NextResponse.json({ error: "Sai mật khẩu" }, { status: 401 });
  }

  const token = await sha256hex(pw + "::arv");
  const res = NextResponse.json({ ok: true });
  res.cookies.set("arv_auth", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 ngày
  });
  return res;
}
