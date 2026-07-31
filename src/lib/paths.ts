import path from "node:path";

// Nơi lưu dữ liệu: mặc định trong repo (dev). Trên server đặt STORAGE_DIR trỏ tới
// ổ đĩa BỀN (persistent disk) để không mất khi redeploy/restart.
const STORAGE_DIR = process.env.STORAGE_DIR || null;

// Thư mục upload: STORAGE_DIR/uploads (prod) hoặc public/uploads (dev, để Next serve tĩnh).
export const UPLOAD_ROOT = STORAGE_DIR
  ? path.join(STORAGE_DIR, "uploads")
  : path.join(process.cwd(), "public", "uploads");

export function projectDir(projectId: string): string {
  return path.join(UPLOAD_ROOT, projectId);
}

export function projectFramesDir(projectId: string): string {
  return path.join(projectDir(projectId), "frames");
}

/** Đường dẫn public (dùng trong <img>/<video> src). Luôn dạng /uploads/... */
export function publicUrl(absPath: string): string {
  const rel = path.relative(UPLOAD_ROOT, absPath).split(path.sep).join("/");
  return "/uploads/" + rel;
}

/** Map URL công khai (VD /uploads/proj/x.mp4) → đường dẫn tuyệt đối trên đĩa. */
export function mediaAbs(url: string): string {
  const clean = url.replace(/^\//, "");
  if (clean.startsWith("uploads/")) {
    return path.join(UPLOAD_ROOT, clean.slice("uploads/".length));
  }
  // các asset tĩnh khác nằm trong public/
  return path.join(process.cwd(), "public", clean);
}
