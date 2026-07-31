import { config } from "../config";
import type { AssetType } from "../types";
import { seededUnit } from "../util";

export interface StockResult {
  provider: string;
  source_url: string;
  source_page_url: string;
  license: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  type: AssetType;
  relevance_score: number;
  quality_score: number;
  has_logo: boolean;
}

/**
 * Tìm B-roll/ảnh có giấy phép rõ ràng. Ưu tiên video, fallback ảnh.
 * Thiếu key -> trả kết quả mock (placeholder) để storyboard vẫn dựng được.
 */
export async function searchStock(
  query: string,
  kind: "video" | "image",
  perPage = 5
): Promise<StockResult[]> {
  try {
    if (config.stock.provider === "pexels" && config.stock.pexelsKey) {
      return await searchPexels(query, kind, perPage);
    }
    if (config.stock.provider === "pixabay" && config.stock.pixabayKey) {
      return await searchPixabay(query, kind, perPage);
    }
  } catch {
    // rơi xuống mock
  }
  return mockStock(query, kind, perPage);
}

async function searchPexels(query: string, kind: "video" | "image", perPage: number): Promise<StockResult[]> {
  const base = kind === "video" ? "https://api.pexels.com/videos/search" : "https://api.pexels.com/v1/search";
  const url = `${base}?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=portrait`;
  const res = await fetch(url, { headers: { Authorization: config.stock.pexelsKey } });
  if (!res.ok) throw new Error(`Pexels ${res.status}`);
  const data = await res.json();
  if (kind === "video") {
    return (data.videos || []).map((v: any) => {
      const file = pickVideoFile(v.video_files || []);
      return {
        provider: "pexels",
        source_url: file?.link || "",
        source_page_url: v.url,
        license: "Pexels License (free to use)",
        width: file?.width ?? v.width ?? null,
        height: file?.height ?? v.height ?? null,
        duration_seconds: v.duration ?? null,
        type: "stock_video" as AssetType,
        relevance_score: 0.85,
        quality_score: 0.9,
        has_logo: false,
      };
    });
  }
  return (data.photos || []).map((p: any) => ({
    provider: "pexels",
    source_url: p.src?.large2x || p.src?.large || p.src?.original,
    source_page_url: p.url,
    license: "Pexels License (free to use)",
    width: p.width,
    height: p.height,
    duration_seconds: null,
    type: "image" as AssetType,
    relevance_score: 0.82,
    quality_score: 0.88,
    has_logo: false,
  }));
}

// Chọn file video hợp lý cho khung dọc: ưu tiên dọc, chiều cao ~1080–1600, .mp4.
function pickVideoFile(files: any[]): any {
  const mp4 = files.filter((f) => (f.file_type || "").includes("mp4") || /\.mp4/.test(f.link || ""));
  const pool = mp4.length ? mp4 : files;
  const scored = pool
    .map((f) => {
      const portrait = (f.height || 0) >= (f.width || 0);
      const h = f.height || 0;
      // gần 1280 là tốt nhất; phạt lệch
      const closeness = 1 - Math.min(1, Math.abs(h - 1280) / 1280);
      return { f, score: (portrait ? 0.5 : 0) + closeness * 0.5 };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.f ?? files[0];
}

async function searchPixabay(query: string, kind: "video" | "image", perPage: number): Promise<StockResult[]> {
  const isVideo = kind === "video";
  const base = isVideo ? "https://pixabay.com/api/videos/" : "https://pixabay.com/api/";
  const url = `${base}?key=${config.stock.pixabayKey}&q=${encodeURIComponent(query)}&per_page=${perPage}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pixabay ${res.status}`);
  const data = await res.json();
  return (data.hits || []).map((h: any) => ({
    provider: "pixabay",
    source_url: isVideo ? h.videos?.large?.url || h.videos?.medium?.url : h.largeImageURL,
    source_page_url: h.pageURL,
    license: "Pixabay License (free to use)",
    width: isVideo ? h.videos?.large?.width ?? null : h.imageWidth,
    height: isVideo ? h.videos?.large?.height ?? null : h.imageHeight,
    duration_seconds: isVideo ? h.duration ?? null : null,
    type: (isVideo ? "stock_video" : "image") as AssetType,
    relevance_score: 0.8,
    quality_score: 0.85,
    has_logo: false,
  }));
}

function mockStock(query: string, kind: "video" | "image", perPage: number): StockResult[] {
  const out: StockResult[] = [];
  for (let i = 0; i < perPage; i++) {
    const rel = 0.6 + seededUnit(`${query}:rel:${i}`) * 0.35;
    out.push({
      provider: "mock",
      source_url: `mock://${kind}/${encodeURIComponent(query)}/${i}`,
      source_page_url: `mock://source/${encodeURIComponent(query)}/${i}`,
      license: "mock (không dùng để xuất bản)",
      width: 1080,
      height: 1920,
      duration_seconds: kind === "video" ? 5 + i : null,
      type: (kind === "video" ? "stock_video" : "image") as AssetType,
      relevance_score: Math.round(rel * 100) / 100,
      quality_score: 0.8,
      has_logo: false,
    });
  }
  return out.sort((a, b) => b.relevance_score - a.relevance_score);
}
