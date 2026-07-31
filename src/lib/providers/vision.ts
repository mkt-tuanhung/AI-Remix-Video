import { promises as fs } from "node:fs";
import path from "node:path";
import type { Shot } from "../types";
import { extractFrame, probe } from "../media/ffmpeg";
import { hasOpenAI, visionJSON } from "./openai";
import { publicUrl, mediaAbs } from "../paths";
import { seededPick, seededUnit } from "../util";

export interface VisionResult {
  provider: "openai" | "mock";
  shots: Shot[];
}

const SYSTEM = `Bạn là chuyên gia phân tích hình ảnh video. Với mỗi keyframe, mô tả ngắn gọn cảnh,
liệt kê người/vật thể/chữ nhìn thấy, có logo hay không, và điểm chất lượng 0..1.
Trả về JSON đúng schema: {"shots":[{"description","people":[],"objects":[],"visible_text":[],"logo_detected":bool,"quality_score":number}]}.`;

const MOCK_SCENES = [
  { d: "Người dẫn nói chuyện trực diện với máy quay trong phòng sáng", p: ["người dẫn"], o: ["micro", "bàn"] },
  { d: "Cận cảnh bàn tay đang thao tác trên laptop", p: [], o: ["laptop", "tay"] },
  { d: "Toàn cảnh không gian làm việc hiện đại", p: [], o: ["ghế", "màn hình", "cây xanh"] },
  { d: "Biểu đồ tăng trưởng hiển thị trên màn hình", p: [], o: ["biểu đồ", "màn hình"] },
  { d: "Người dẫn mỉm cười, chỉ tay về phía trước", p: ["người dẫn"], o: [] },
  { d: "Cảnh ngoài trời, ánh sáng tự nhiên buổi sáng", p: ["người đi bộ"], o: ["cây", "đường"] },
];

/**
 * Tách shot đều theo thời lượng rồi lấy keyframe + phân tích.
 * MVP: chia shot theo lưới thời gian (shot detection nâng cao để pha sau).
 */
export async function runVision(
  videoPath: string,
  projectId: string,
  durationSeconds: number | null,
  framesDir: string
): Promise<VisionResult> {
  const duration = durationSeconds ?? (await probe(videoPath))?.duration_seconds ?? 30;
  const shotLen = 4; // giây/shot cho MVP
  const count = Math.max(3, Math.min(12, Math.round(duration / shotLen)));

  const shots: Shot[] = [];
  for (let i = 0; i < count; i++) {
    const start = Math.round((i * (duration / count)) * 10) / 10;
    const end = Math.round(((i + 1) * (duration / count)) * 10) / 10;
    const mid = (start + end) / 2;
    const framePath = path.join(framesDir, `${projectId}_shot_${i + 1}.jpg`);
    const frame = await extractFrame(videoPath, mid, framePath);
    shots.push({
      shot_id: `shot_${String(i + 1).padStart(3, "0")}`,
      start_time: start,
      end_time: end,
      description: "",
      people: [],
      objects: [],
      visible_text: [],
      logo_detected: false,
      quality_score: 0,
      reuse_eligible: true,
      keyframe_path: frame ? publicUrl(framePath) : null,
    });
  }

  // Đường đi thật: gửi keyframe cho GPT-4o vision.
  if (hasOpenAI()) {
    const withFrames = shots.filter((s) => s.keyframe_path);
    if (withFrames.length) {
      try {
        const dataUrls: string[] = [];
        for (const s of withFrames) {
          const abs = mediaAbs(s.keyframe_path!);
          const b = await fs.readFile(abs);
          dataUrls.push(`data:image/jpeg;base64,${b.toString("base64")}`);
        }
        const out = await visionJSON<{ shots: any[] }>(
          SYSTEM,
          `Phân tích ${dataUrls.length} keyframe theo thứ tự. Mỗi ảnh là một shot.`,
          dataUrls
        );
        out.shots?.forEach((a, i) => {
          const s = withFrames[i];
          if (!s) return;
          s.description = a.description || "";
          s.people = a.people || [];
          s.objects = a.objects || [];
          s.visible_text = a.visible_text || [];
          s.logo_detected = !!a.logo_detected;
          s.quality_score = typeof a.quality_score === "number" ? a.quality_score : 0.8;
          s.reuse_eligible = s.quality_score >= 0.55 && !s.logo_detected;
        });
        return { provider: "openai", shots };
      } catch {
        // lỗi vision -> fallback mock cho phần mô tả
      }
    }
  }

  // Mock tất định.
  shots.forEach((s, i) => {
    const m = seededPick(`${projectId}:vis:${i}`, MOCK_SCENES);
    const q = 0.6 + seededUnit(`${projectId}:q:${i}`) * 0.35;
    s.description = m.d;
    s.people = m.p;
    s.objects = m.o;
    s.visible_text = [];
    s.logo_detected = seededUnit(`${projectId}:logo:${i}`) > 0.85;
    s.quality_score = Math.round(q * 100) / 100;
    s.reuse_eligible = s.quality_score >= 0.55 && !s.logo_detected;
  });
  return { provider: "mock", shots };
}
