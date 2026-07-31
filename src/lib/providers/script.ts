import type {
  ContentStrategy,
  Fact,
  Hook,
  Platform,
  Scene,
  Shot,
  SourceAnalysis,
} from "../types";
import { chatJSON, hasOpenAI } from "./openai";
import { estimateSpeechSeconds, seededPick, seededUnit, uid } from "../util";

// ─────────────────────────────────────────────────────────────
// Sinh chiến lược, hook, viết lại kịch bản, chia storyboard.
// Có mock fallback tất định để chạy khi chưa cắm OpenAI.
// ─────────────────────────────────────────────────────────────

const GOAL_ANGLES: Record<string, string[]> = {
  remix: ["Kể lại ngắn gọn, cuốn hút hơn", "Nhấn vào bài học rút ra"],
  summarize: ["Tóm tắt 3 ý chính", "Bản rút gọn cho người bận rộn"],
  expand: ["Đào sâu từng luận điểm", "Thêm ví dụ và ngữ cảnh"],
  explainer: ["Giải thích từng bước dễ hiểu", "Trả lời câu hỏi thường gặp"],
  news: ["Bản tin nhanh, khách quan", "Điểm tin theo dòng sự kiện"],
  story: ["Kể theo hành trình nhân vật", "Mở bằng cao trào"],
  review: ["Ưu – nhược điểm rõ ràng", "So sánh và khuyến nghị"],
  sales: ["Nêu nỗi đau → giải pháp", "Chứng minh kết quả → kêu gọi hành động"],
  education: ["Bài học có cấu trúc", "Kèm mẹo ghi nhớ"],
};

// ── Chiến lược ───────────────────────────────────────────────
export async function generateStrategies(
  analysis: SourceAnalysis,
  goal: string,
  platform: Platform,
  targetSeconds: number
): Promise<{ provider: "openai" | "mock"; items: ContentStrategy[] }> {
  if (hasOpenAI() && analysis.transcript.trim()) {
    try {
      const out = await chatJSON<{ strategies: any[] }>(
        `Bạn là chiến lược gia nội dung video ngắn. Đề xuất 2-3 chiến lược tái sản xuất khác nhau.
Trả JSON: {"strategies":[{"angle","audience","emotion","pacing":"slow|medium|fast","recommended_duration_seconds":number,"rationale"}]}`,
        `Chủ đề: ${analysis.main_topic}\nMục tiêu: ${goal}\nNền tảng: ${platform}\nThời lượng mục tiêu: ${targetSeconds}s\nTranscript: ${analysis.transcript}`,
        { temperature: 0.7 }
      );
      const items = (out.strategies || []).map((s) => normalizeStrategy(s, platform, targetSeconds));
      if (items.length) return { provider: "openai", items };
    } catch {
      /* fallback */
    }
  }
  const angles = GOAL_ANGLES[goal] ?? GOAL_ANGLES.remix;
  const items: ContentStrategy[] = angles.map((angle, i) => ({
    id: uid("strat"),
    angle,
    audience: seededPick(`${analysis.id}:aud:${i}`, ["Người trẻ 18-30", "Người đi làm bận rộn", "Người mới bắt đầu"]),
    emotion: seededPick(`${analysis.id}:emo:${i}`, ["tò mò", "hứng khởi", "đồng cảm", "quyết tâm"]),
    pacing: (["fast", "medium"] as const)[i % 2],
    recommended_duration_seconds: targetSeconds,
    recommended_platform: platform,
    rationale: `Phù hợp mục tiêu "${goal}" và thế mạnh của ${platform}.`,
  }));
  return { provider: "mock", items };
}

function normalizeStrategy(s: any, platform: Platform, targetSeconds: number): ContentStrategy {
  const pacing = ["slow", "medium", "fast"].includes(s.pacing) ? s.pacing : "medium";
  return {
    id: uid("strat"),
    angle: s.angle || "Kể lại hấp dẫn hơn",
    audience: s.audience || "Người xem phổ thông",
    emotion: s.emotion || "tò mò",
    pacing,
    recommended_duration_seconds: s.recommended_duration_seconds || targetSeconds,
    recommended_platform: platform,
    rationale: s.rationale || "",
  };
}

// ── Hook (tối thiểu 3, có chấm điểm) ─────────────────────────
const HOOK_TEMPLATES: { type: Hook["type"]; make: (topic: string) => string }[] = [
  { type: "question", make: (t) => `Bạn có biết điều gì khiến ${t.toLowerCase()} trở nên khác biệt?` },
  { type: "surprise", make: () => `Có một sự thật mà 90% người xem không để ý…` },
  { type: "pain", make: () => `Nếu bạn từng bỏ cuộc giữa chừng, video này dành cho bạn.` },
  { type: "result", make: () => `Chỉ sau 7 ngày, kết quả sẽ khiến bạn bất ngờ.` },
  { type: "climax", make: () => `Khoảnh khắc thay đổi mọi thứ bắt đầu từ đây.` },
];

export async function generateHooks(
  analysis: SourceAnalysis
): Promise<{ provider: "openai" | "mock"; items: Hook[] }> {
  if (hasOpenAI() && analysis.transcript.trim()) {
    try {
      const out = await chatJSON<{ hooks: any[] }>(
        `Bạn là chuyên gia viết hook mở đầu video ngắn. Tạo đúng 5 hook thuộc các kiểu: question, surprise, pain, result, climax.
Chấm điểm 0..1 cho: clarity, curiosity, relevance, retention_3s, honesty (không giật tít sai sự thật).
Trả JSON: {"hooks":[{"type","text","clarity","curiosity","relevance","retention_3s","honesty"}]}`,
        `Chủ đề: ${analysis.main_topic}\nHook gốc: ${analysis.source_hook}\nTranscript: ${analysis.transcript}`,
        { temperature: 0.8 }
      );
      const items = (out.hooks || []).map((h) => normalizeHook(h));
      if (items.length >= 3) return { provider: "openai", items };
    } catch {
      /* fallback */
    }
  }
  const items: Hook[] = HOOK_TEMPLATES.map((h, i) => ({
    id: uid("hook"),
    type: h.type,
    text: h.make(analysis.main_topic || "chủ đề này"),
    scores: {
      clarity: round(0.7 + seededUnit(`${analysis.id}:cl:${i}`) * 0.25),
      curiosity: round(0.65 + seededUnit(`${analysis.id}:cu:${i}`) * 0.3),
      relevance: round(0.7 + seededUnit(`${analysis.id}:re:${i}`) * 0.25),
      retention_3s: round(0.6 + seededUnit(`${analysis.id}:rt:${i}`) * 0.35),
      honesty: round(0.85 + seededUnit(`${analysis.id}:ho:${i}`) * 0.15),
    },
  }));
  return { provider: "mock", items };
}

function normalizeHook(h: any): Hook {
  const type = ["question", "surprise", "pain", "result", "climax"].includes(h.type) ? h.type : "surprise";
  const s = (v: any) => (typeof v === "number" ? Math.max(0, Math.min(1, v)) : 0.8);
  return {
    id: uid("hook"),
    type,
    text: h.text || "",
    scores: {
      clarity: s(h.clarity),
      curiosity: s(h.curiosity),
      relevance: s(h.relevance),
      retention_3s: s(h.retention_3s),
      honesty: s(h.honesty),
    },
  };
}

export function hookOverall(h: Hook): number {
  const w = h.scores;
  return round((w.clarity + w.curiosity + w.relevance + w.retention_3s + w.honesty) / 5);
}

// ── Viết lại kịch bản (đo thời lượng bằng ước lượng voice) ───
export async function rewriteScript(
  analysis: SourceAnalysis,
  hook: Hook,
  goal: string,
  targetSeconds: number
): Promise<{ provider: "openai" | "mock"; script: string; cta: string; estimated_seconds: number }> {
  const targetWords = Math.round(targetSeconds * 2.6);

  if (hasOpenAI() && analysis.transcript.trim()) {
    try {
      const facts = analysis.facts.map((f) => `- (${f.kind}) ${f.text}`).join("\n");
      const out = await chatJSON<{ script: string; cta: string }>(
        `Bạn là biên kịch video ngắn. Viết lại kịch bản GIỮ ĐÚNG dữ kiện, cấu trúc rõ (hook → thân → kết),
câu ngắn dễ đọc thành voice, KHÔNG bịa thêm thông tin. Độ dài ~${targetWords} từ (~${targetSeconds}s).
Bắt đầu bằng hook đã cho. Trả JSON: {"script": "...", "cta": "..."}`,
        `Chủ đề: ${analysis.main_topic}\nMục tiêu: ${goal}\nHook: ${hook.text}\nDữ kiện (không được sai):\n${facts}\nTranscript gốc: ${analysis.transcript}`,
        { temperature: 0.7 }
      );
      const script = (out.script || "").trim();
      if (script) {
        return {
          provider: "openai",
          script,
          cta: (out.cta || "").trim(),
          estimated_seconds: estimateSpeechSeconds(script),
        };
      }
    } catch {
      /* fallback */
    }
  }

  // Mock: ghép hook + dữ kiện (không bịa) + CTA, co giãn quanh targetWords.
  const factLines = analysis.facts.map((f) => f.text).filter(Boolean);
  const bodyPool = factLines.length ? factLines : analysis.transcript.split(/(?<=[.!?])\s+/).filter(Boolean);
  const body: string[] = [];
  let i = 0;
  while (wordCount([hook.text, ...body].join(" ")) < targetWords - 12 && i < bodyPool.length * 3) {
    body.push(bodyPool[i % bodyPool.length]);
    i++;
  }
  const cta = deriveCta(goal, analysis);
  const script = [hook.text, ...dedupeKeepOrder(body)].join(" ");
  return { provider: "mock", script, cta, estimated_seconds: estimateSpeechSeconds(`${script} ${cta}`) };
}

function deriveCta(goal: string, analysis: SourceAnalysis): string {
  const map: Record<string, string> = {
    sales: "Nhắn tin cho mình để được tư vấn ngay hôm nay nhé.",
    education: "Lưu lại video để xem lại khi cần bạn nhé.",
    review: "Bình luận cho mình biết bạn chọn phương án nào.",
    news: "Theo dõi để không bỏ lỡ các bản tin tiếp theo.",
  };
  return map[goal] || analysis.source_cta || "Theo dõi kênh để xem thêm nội dung mới nhé.";
}

// ── Chia storyboard (theo ý nghĩa, không máy móc theo giây) ──
export async function splitStoryboard(
  script: string,
  cta: string,
  analysis: SourceAnalysis,
  variantId: string,
  targetSeconds: number
): Promise<{ provider: "openai" | "mock"; scenes: Scene[] }> {
  const reusableShots = analysis.shots.filter((s) => s.reuse_eligible);

  if (hasOpenAI() && script.trim()) {
    try {
      const out = await chatJSON<{ scenes: any[] }>(
        `Bạn là đạo diễn dựng phim ngắn. Chia kịch bản thành các cảnh theo Ý NGHĨA.
Mỗi cảnh: narration (1 câu), purpose, visual_intent, asset_type (source_clip|stock_video|image|ai_visual|motion_graphic),
search_queries (2-3 từ khoá tiếng Anh để tìm stock), on_screen_text (ngắn), effect, transition, priority(low|medium|high).
Trả JSON: {"scenes":[...]}`,
        `Kịch bản: ${script}\nCTA: ${cta}\nCó ${reusableShots.length} cảnh nguồn tái dùng được.`,
        { temperature: 0.5 }
      );
      const scenes = buildScenes((out.scenes || []).map(normalizeScene), variantId, targetSeconds, reusableShots);
      if (scenes.length) return { provider: "openai", scenes };
    } catch {
      /* fallback */
    }
  }

  // Mock: mỗi câu = 1 cảnh; CTA = cảnh cuối.
  const sentences = [...script.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)];
  if (cta) sentences.push(cta);
  const raw = sentences.map((narration, i) => ({
    narration,
    purpose: i === 0 ? "Hook giữ chân" : i === sentences.length - 1 ? "Kêu gọi hành động" : "Truyền tải ý",
    visual_intent: pickVisualIntent(narration, analysis),
    asset_type: chooseAssetType(i, reusableShots.length),
    search_queries: keywords(narration),
    on_screen_text: emphasis(narration),
    effect: i === 0 ? "zoom" : seededPick(`fx:${variantId}:${i}`, ["cut", "push", "pan", "crossfade"]),
    transition: "cut",
    priority: (i === 0 || i === sentences.length - 1 ? "high" : "medium") as Scene["priority"],
  }));
  return { provider: "mock", scenes: buildScenes(raw, variantId, targetSeconds, reusableShots) };
}

function buildScenes(
  raw: Omit<Scene, "id" | "variant_id" | "order" | "start_time" | "end_time" | "asset_id" | "scene_voice_match_score">[],
  variantId: string,
  targetSeconds: number,
  reusableShots: Shot[]
): Scene[] {
  const total = raw.reduce((s, r) => s + estimateSpeechSeconds(r.narration), 0) || 1;
  let t = 0;
  return raw.map((r, i) => {
    const dur = Math.max(1.5, (estimateSpeechSeconds(r.narration) / total) * targetSeconds);
    const start = round(t);
    t += dur;
    // Gợi ý cảnh nguồn tái dùng cho asset_type = source_clip.
    const srcShot = r.asset_type === "source_clip" ? reusableShots[i % Math.max(1, reusableShots.length)] : undefined;
    return {
      id: uid("scene"),
      variant_id: variantId,
      order: i,
      start_time: start,
      end_time: round(t),
      asset_id: null,
      scene_voice_match_score: null,
      ...r,
      // ghi chú cảnh nguồn vào visual_intent nếu có
      visual_intent: srcShot ? `${r.visual_intent} · gợi ý cảnh nguồn ${srcShot.shot_id}` : r.visual_intent,
    };
  });
}

function normalizeScene(s: any): any {
  const types = ["source_clip", "stock_video", "image", "ai_visual", "motion_graphic"];
  return {
    narration: s.narration || "",
    purpose: s.purpose || "",
    visual_intent: s.visual_intent || "",
    asset_type: types.includes(s.asset_type) ? s.asset_type : "stock_video",
    search_queries: Array.isArray(s.search_queries) ? s.search_queries.slice(0, 3) : [],
    on_screen_text: s.on_screen_text || "",
    effect: s.effect || "cut",
    transition: s.transition || "cut",
    priority: ["low", "medium", "high"].includes(s.priority) ? s.priority : "medium",
  };
}

function chooseAssetType(i: number, reusableCount: number): Scene["asset_type"] {
  if (reusableCount > 0 && i % 3 === 0) return "source_clip";
  return i % 4 === 3 ? "motion_graphic" : i % 2 ? "image" : "stock_video";
}

function pickVisualIntent(narration: string, analysis: SourceAnalysis): string {
  const shot = analysis.shots.find((s) =>
    narration.toLowerCase().split(/\s+/).some((w) => s.description.toLowerCase().includes(w) && w.length > 4)
  );
  return shot ? shot.description : "Hình ảnh minh hoạ khớp lời thoại";
}

function emphasis(text: string): string {
  const words = text.replace(/[.!?,]/g, "").split(/\s+/).filter((w) => w.length > 4);
  return words.slice(0, 2).join(" ");
}

const STOP = new Set(["bạn", "của", "một", "này", "rằng", "được", "những", "cho", "khi", "thì", "là", "và", "có", "không"]);
function keywords(text: string): string[] {
  const words = text.toLowerCase().replace(/[.!?,]/g, "").split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w));
  return Array.from(new Set(words)).slice(0, 3);
}

function dedupeKeepOrder(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter((x) => (seen.has(x) ? false : (seen.add(x), true)));
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// Re-export cho tiện.
export type { Fact };
