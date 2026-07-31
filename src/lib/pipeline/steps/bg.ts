import { store } from "../../store";
import type { Asset, Project, Scene, SourceVideo } from "../../types";
import type { SceneBg } from "../../media/render";
import { probe } from "../../media/ffmpeg";
import { mediaAbs as abs } from "../../paths";

/**
 * Dựng map sceneId → nền footage.
 * - Cảnh có asset đã tải (Pexels) → dùng file đó.
 * - Cảnh source_clip → dùng video nguồn (nếu giải mã được).
 * - Còn lại → không có (renderer tự dùng thẻ chữ).
 */
export async function buildBgMap(project: Project, scenes: Scene[]): Promise<Map<string, SceneBg>> {
  const map = new Map<string, SceneBg>();

  const assets = await store().list<Asset>("assets", { project_id: project.id } as Partial<Asset>);
  const byId = new Map(assets.map((a) => [a.id, a]));

  // Video nguồn (cho source_clip) — chỉ dùng nếu giải mã được.
  let sourceVideoPath: string | null = null;
  if (project.source_video_id) {
    const sv = await store().get<SourceVideo>("source_videos", project.source_video_id);
    if (sv) {
      const p = abs(sv.storage_path);
      const meta = await probe(p);
      if (meta && (meta.width ?? 0) > 0) sourceVideoPath = p;
    }
  }

  for (const sc of scenes) {
    const asset = sc.asset_id ? byId.get(sc.asset_id) : undefined;
    if (asset?.local_path) {
      map.set(sc.id, {
        kind: asset.type === "image" ? "image" : "video",
        path: abs(asset.local_path),
      });
      continue;
    }
    if (sc.asset_type === "source_clip" && sourceVideoPath) {
      map.set(sc.id, { kind: "video", path: sourceVideoPath });
    }
  }
  return map;
}
