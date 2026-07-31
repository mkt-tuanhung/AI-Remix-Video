import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "../config";

// Image-to-video (nhân vật chuyển động) qua fal.ai (LTX).
// Thiếu FAL_KEY → trả null → pipeline giữ ảnh tĩnh (Ken Burns).

export interface AnimateResult {
  provider: "fal";
  path: string; // file .mp4 tuyệt đối
}

export function hasFal(): boolean {
  return !!config.fal.key;
}

async function fileToDataUri(p: string): Promise<string> {
  const buf = await fs.readFile(p);
  const ext = path.extname(p).toLowerCase();
  const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

/**
 * Làm 1 ảnh chuyển động thành clip. Trả về đường dẫn .mp4 hoặc null nếu lỗi/thiếu key.
 */
export async function animateImage(
  imageAbsPath: string,
  prompt: string,
  outPath: string
): Promise<AnimateResult | null> {
  if (!config.fal.key) return null;
  try {
    const image_url = await fileToDataUri(imageAbsPath);
    const body = JSON.stringify({ image_url, prompt: prompt.slice(0, 1500) });
    const headers = {
      Authorization: `Key ${config.fal.key}`,
      "Content-Type": "application/json",
    };

    // Gọi đồng bộ; nếu fal trả về hàng đợi thì poll response_url.
    let res = await fetch(`https://fal.run/${config.fal.videoModel}`, { method: "POST", headers, body });
    let data: any = await res.json();

    if (!res.ok && !data?.video && (data?.status_url || data?.response_url)) {
      // hiếm khi xảy ra ở fal.run, nhưng phòng hờ
    }
    // Trường hợp hàng đợi (queue.fal.run style): poll cho tới khi có video.
    if (data?.status && (data?.response_url || data?.status_url)) {
      const respUrl = data.response_url || data.status_url;
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const p = await fetch(respUrl, { headers });
        const pd = await p.json();
        if (pd?.video?.url) { data = pd; break; }
        if (pd?.status === "FAILED" || pd?.error) return null;
      }
    }

    const url = data?.video?.url || data?.videos?.[0]?.url;
    if (!url) return null;

    const vid = await fetch(url);
    if (!vid.ok) return null;
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, Buffer.from(await vid.arrayBuffer()));
    return { provider: "fal", path: outPath };
  } catch {
    return null;
  }
}
