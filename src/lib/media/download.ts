import { promises as fs } from "node:fs";
import path from "node:path";

const MAX_BYTES = 60 * 1024 * 1024; // 60MB/asset để tránh tải file quá lớn

/**
 * Tải 1 URL về đĩa. Trả về đường dẫn tuyệt đối, hoặc null nếu lỗi/quá lớn/không phải http.
 */
export async function downloadToFile(url: string, outPath: string): Promise<string | null> {
  if (!/^https?:\/\//i.test(url)) return null; // bỏ qua mock:// và url không hợp lệ
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok || !res.body) return null;

    const len = Number(res.headers.get("content-length") || 0);
    if (len && len > MAX_BYTES) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return null;

    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, buf);
    return outPath;
  } catch {
    return null;
  }
}

/** Đoán đuôi file từ url/loại. */
export function extFor(url: string, kind: "video" | "image"): string {
  const m = url.split("?")[0].match(/\.([a-z0-9]{2,4})$/i);
  if (m) return "." + m[1].toLowerCase();
  return kind === "video" ? ".mp4" : ".jpg";
}
