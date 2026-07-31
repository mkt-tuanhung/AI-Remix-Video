import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "../config";

// Image-to-video (nhân vật chuyển động) qua fal.ai (LTX).
// Thiếu FAL_KEY → trả null → pipeline giữ ảnh tĩnh (Ken Burns).

export interface AnimateResult {
  provider: "fal" | "freepik";
  path: string; // file .mp4 tuyệt đối
}

export function hasFal(): boolean {
  return !!config.fal.key;
}

/** Có backend sinh video tự động nào bật không (freepik hoặc fal). */
export function hasVideoGen(): boolean {
  return config.videoProvider !== "none";
}

async function fileToBase64(p: string): Promise<string> {
  const buf = await fs.readFile(p);
  return buf.toString("base64");
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
  // Ưu tiên Freepik (nếu có key), else fal.
  if (config.videoProvider === "freepik") {
    return animateImageFreepik(imageAbsPath, prompt, outPath);
  }
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

/**
 * Freepik AI image-to-video (async task → poll → download).
 * Endpoint & model slug có thể khác theo gói; đổi qua FREEPIK_VIDEO_MODEL.
 */
async function animateImageFreepik(
  imageAbsPath: string,
  prompt: string,
  outPath: string
): Promise<AnimateResult | null> {
  const key = config.freepik.key;
  if (!key) return null;
  const model = config.freepik.videoModel;
  const base = `https://api.freepik.com/v1/ai/image-to-video/${model}`;
  const headers = { "x-freepik-api-key": key, "Content-Type": "application/json" };
  try {
    const image = await fileToBase64(imageAbsPath);
    const res = await fetch(base, {
      method: "POST",
      headers,
      body: JSON.stringify({ image, prompt: prompt.slice(0, 1500), duration: "5" }),
    });
    const created: any = await res.json();
    const taskId = created?.data?.task_id || created?.task_id;
    if (!taskId) return null;

    // Poll cho tới khi xong (tối đa ~5 phút).
    let url: string | null = null;
    for (let i = 0; i < 100; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const p = await fetch(`${base}/${taskId}`, { headers });
      const pd: any = await p.json();
      const status = pd?.data?.status || pd?.status;
      const gen = pd?.data?.generated || pd?.generated || pd?.data?.result;
      if (Array.isArray(gen) && gen.length) { url = typeof gen[0] === "string" ? gen[0] : gen[0]?.url; }
      if (url) break;
      if (status === "FAILED" || status === "ERROR" || pd?.error) return null;
    }
    if (!url) return null;

    const vid = await fetch(url);
    if (!vid.ok) return null;
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, Buffer.from(await vid.arrayBuffer()));
    return { provider: "freepik", path: outPath };
  } catch {
    return null;
  }
}
