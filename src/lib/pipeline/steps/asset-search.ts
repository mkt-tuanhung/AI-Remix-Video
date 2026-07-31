import type { StepContext } from "../context";
import { store } from "../../store";
import type { Asset, Project, Scene } from "../../types";
import path from "node:path";
import { searchStock } from "../../providers/stock";
import { downloadToFile, extFor } from "../../media/download";
import { projectDir } from "../../paths";
import { nowISO, seededUnit, uid } from "../../util";
import { primaryVariant } from "./storyboard";
import { enqueueChain } from "../../orchestrator/queue";
import { PRODUCTION_PIPELINE } from "../registry";

// ASSET_SEARCH — đặc tả 8.13–8.14: tìm + chấm điểm tài nguyên, gán vào cảnh.
export async function assetSearch(ctx: StepContext): Promise<void> {
  const { project } = ctx;
  const variant = await primaryVariant(project.id);
  if (!variant) throw new Error("Chưa có variant");

  const scenes = (await store().list<Scene>("scenes", { variant_id: variant.id } as Partial<Scene>)).sort(
    (a, b) => a.order - b.order
  );
  if (!scenes.length) throw new Error("Chưa có cảnh nào");

  let done = 0;
  for (const scene of scenes) {
    done++;
    await ctx.setProgress(done / scenes.length, `Tìm tài nguyên cảnh ${done}/${scenes.length}`);

    // motion_graphic / ai_visual: chưa tìm stock, sẽ tạo ở bước render sau. Chấm điểm heuristic.
    if (scene.asset_type === "motion_graphic" || scene.asset_type === "ai_visual") {
      await store().update<Scene>("scenes", scene.id, { scene_voice_match_score: 0.8 });
      continue;
    }

    // source_clip: dùng cảnh nguồn, điểm khớp cao (đã kiểm reuse_eligible ở vision).
    if (scene.asset_type === "source_clip") {
      await store().update<Scene>("scenes", scene.id, {
        scene_voice_match_score: round(0.82 + seededUnit(`${scene.id}:src`) * 0.15),
      });
      continue;
    }

    const kind = scene.asset_type === "image" ? "image" : "video";
    const query = (scene.search_queries[0] || scene.visual_intent || scene.narration).slice(0, 60);
    const results = await searchStock(query, kind, 5);
    // Ưu tiên: khớp ý nghĩa > chất lượng > không logo (đặc tả 8.14).
    const best = results
      .filter((r) => !r.has_logo)
      .sort((a, b) => b.relevance_score * 0.6 + b.quality_score * 0.4 - (a.relevance_score * 0.6 + a.quality_score * 0.4))[0]
      ?? results[0];

    if (!best) {
      await store().update<Scene>("scenes", scene.id, { scene_voice_match_score: 0.5 });
      continue;
    }

    const assetId = uid("asset");

    // Tải file thật về đĩa để render dùng làm nền (bỏ qua mock://).
    let localPath: string | null = null;
    const ext = extFor(best.source_url, kind);
    const dest = path.join(projectDir(project.id), "assets", `${assetId}${ext}`);
    const saved = await downloadToFile(best.source_url, dest);
    if (saved) localPath = `/uploads/${project.id}/assets/${assetId}${ext}`;

    const asset: Asset = {
      id: assetId,
      project_id: project.id,
      type: best.type,
      source_url: best.source_url,
      source_page_url: best.source_page_url,
      provider: best.provider,
      license: best.license,
      width: best.width,
      height: best.height,
      duration_seconds: best.duration_seconds,
      has_logo: best.has_logo,
      quality_score: best.quality_score,
      relevance_score: best.relevance_score,
      crop: null,
      local_path: localPath,
    };
    await store().insert<Asset>("assets", asset);
    await store().update<Scene>("scenes", scene.id, {
      asset_id: asset.id,
      scene_voice_match_score: round(best.relevance_score * 0.7 + best.quality_score * 0.3),
    });
  }

  if (project.auto) {
    await store().update<Project>("projects", project.id, { status: "GENERATING_VOICE", updated_at: nowISO() });
    await enqueueChain(project.id, PRODUCTION_PIPELINE);
  } else {
    await store().update<Project>("projects", project.id, {
      status: "WAITING_FOR_MEDIA_APPROVAL",
      updated_at: nowISO(),
    });
  }
  await ctx.setProgress(1, "Đã gán tài nguyên cho các cảnh");
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
