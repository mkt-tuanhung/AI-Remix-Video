import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "../config";
import { runFfmpeg } from "../media/ffmpeg";
import { seededUnit } from "../util";

// Sinh ảnh AI cho từng khung (module Truyện → Phim).
// Thật: OpenAI Images (dall-e-3). Thiếu key: ảnh gradient placeholder qua ffmpeg.

export interface ImageResult {
  provider: "openai" | "mock";
  path: string; // đường dẫn tuyệt đối file ảnh (.png)
}

/**
 * Sinh 1 ảnh theo prompt (đã kèm style thể loại), lưu ra outPath.
 * size dọc 1024x1792 cho khung 9:16.
 */
export async function generateSceneImage(
  prompt: string,
  outPath: string,
  size = "1024x1792"
): Promise<ImageResult> {
  await fs.mkdir(path.dirname(outPath), { recursive: true });

  if (config.openai.key) {
    // Thử tối đa 2 lần để giảm khung bị gradient khi API lỗi tạm thời.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.openai.key}`,
          },
          body: JSON.stringify({
            model: "gpt-image-1",
            prompt: prompt.slice(0, 3900),
            n: 1,
            size, // gpt-image-1: 1024x1024 | 1024x1536 | 1536x1024
            quality: "medium",
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const item = data?.data?.[0];
          if (item?.b64_json) {
            await fs.writeFile(outPath, Buffer.from(item.b64_json, "base64"));
            return { provider: "openai", path: outPath };
          }
          if (item?.url) {
            const img = await fetch(item.url);
            if (img.ok) {
              await fs.writeFile(outPath, Buffer.from(await img.arrayBuffer()));
              return { provider: "openai", path: outPath };
            }
          }
        }
        // lỗi (content policy, rate limit…) → thử lại 1 lần rồi placeholder
      } catch {
        /* thử lại */
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // Placeholder gradient (khi chưa cắm key hoặc ảnh lỗi) để phim vẫn có khung.
  const [w, h] = size.split("x");
  const u = seededUnit(prompt);
  const c0 = pickColor(u);
  const c1 = pickColor(u * 3.7 + 0.3);
  await runFfmpeg([
    "-y",
    "-f", "lavfi",
    "-i", `gradients=s=${w}x${h}:c0=0x${c0}:c1=0x${c1}:x0=0:y0=0:x1=${w}:y1=${h}`,
    "-frames:v", "1",
    outPath,
  ]);
  return { provider: "mock", path: outPath };
}

function pickColor(u: number): string {
  const palette = ["1e3a5f", "3b1f4e", "0f4c3a", "5f2d1e", "2d3a5f", "4e3b1f", "1f4e4a"];
  return palette[Math.floor((u % 1) * palette.length) % palette.length];
}

// Hậu tố style cho từng thể loại — ghép vào prompt cảnh.
export const GENRE_STYLE: Record<string, string> = {
  "2d": "flat 2D cartoon animation still, bold clean outlines, vibrant flat colors, cel-shaded, storybook",
  "3d": "3D animated movie still, Pixar/DreamWorks style render, soft global illumination, subsurface scattering, cinematic",
  epic: "epic cinematic concept art, dramatic volumetric lighting, highly detailed, matte painting, movie key art",
  papercut: "paper-cut collage art, layered cutout construction paper, handcrafted diorama, soft shadows between layers",
  handdrawn: "hand-drawn storybook illustration, pencil linework with soft watercolor washes, warm and cozy",
  watercolor: "loose watercolor painting, soft bleeding pigments, textured paper, dreamy pastel palette",
  realistic: "photorealistic cinematic photograph, natural lighting, shallow depth of field, film grain",
};

export const GENRE_LABEL: Record<string, string> = {
  "2d": "Hoạt hình 2D",
  "3d": "Hoạt hình 3D",
  epic: "Epic điện ảnh",
  papercut: "Hoạt hình xé giấy",
  handdrawn: "Vẽ tay",
  watercolor: "Màu nước",
  realistic: "Chân thực",
};
