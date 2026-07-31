import { NextResponse, type NextRequest } from "next/server";

// Cổng mật khẩu chung: nếu đặt APP_PASSWORD thì mọi trang/API đều cần đăng nhập.
// Không đặt APP_PASSWORD => tắt cổng (chạy local thoải mái).

async function sha256hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function middleware(req: NextRequest) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return NextResponse.next();

  const { pathname } = req.nextUrl;
  // Cho qua trang đăng nhập + API đăng nhập.
  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();

  const token = req.cookies.get("arv_auth")?.value;
  const expected = await sha256hex(pw + "::arv");
  if (token === expected) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

// Bỏ qua tài nguyên tĩnh của Next.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
