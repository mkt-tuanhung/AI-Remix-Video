import type { Scene, StoryGenre } from "../types";
import { chatJSON, hasOpenAI } from "./openai";
import { GENRE_STYLE } from "./image";
import { estimateSpeechSeconds, uid } from "../util";
import type { Lang } from "./script";

// Module Truyện → Phim: từ 1 nội dung → kịch bản → chia khung + prompt ảnh theo thể loại.

const langName = (l: Lang) => (l === "en" ? "English" : "Vietnamese");

export interface StoryScript {
  provider: "openai" | "mock";
  title: string;
  script: string; // lời kể (narration) toàn phim
}

export async function writeStoryScript(
  storyText: string,
  genre: StoryGenre,
  lang: Lang,
  targetSeconds: number
): Promise<StoryScript> {
  const targetWords = Math.round(targetSeconds * (lang === "en" ? 2.8 : 2.6));
  if (hasOpenAI() && storyText.trim()) {
    try {
      const out = await chatJSON<{ title: string; script: string }>(
        `You are a scriptwriter for short narrated films. Turn the given story/premise into an engaging
voiceover NARRATION script with a clear beginning, middle and end. Vivid but concise, short sentences
suitable for text-to-speech. Length ~${targetWords} words (~${targetSeconds}s). Write in ${langName(lang)}.
Return JSON: {"title": "...", "script": "..."}`,
        `Genre/visual style: ${genre}\nStory/premise:\n${storyText}`,
        { temperature: 0.8 }
      );
      if (out.script?.trim()) {
        return { provider: "openai", title: out.title || "Untitled", script: out.script.trim() };
      }
    } catch {
      /* fallback */
    }
  }
  // Mock: dùng chính nội dung nhập làm narration.
  const script = storyText.trim() || "Ngày xửa ngày xưa, có một câu chuyện nhỏ đáng nhớ.";
  return { provider: "mock", title: "Câu chuyện", script };
}

export interface StoryboardResult {
  provider: "openai" | "mock";
  scenes: Scene[];
}

export async function splitStoryScenes(
  title: string,
  script: string,
  genre: StoryGenre,
  lang: Lang,
  variantId: string,
  targetSeconds: number
): Promise<StoryboardResult> {
  const style = GENRE_STYLE[genre] ?? GENRE_STYLE["2d"];
  const wantScenes = Math.max(4, Math.min(10, Math.round(targetSeconds / 7)));

  if (hasOpenAI() && script.trim()) {
    try {
      // Tạo "hồ sơ nhân vật + bối cảnh" cố định, rồi từng cảnh chỉ mô tả HÀNH ĐỘNG.
      const out = await chatJSON<{ characters: string; setting: string; scenes: any[] }>(
        `You are a film storyboard artist. First define a FIXED visual "character sheet":
"characters" = one detailed English description of the main character(s): species/type, exact colors,
clothing, distinctive features — this MUST stay identical in every scene for consistency.
"setting" = the consistent world, art direction and color palette.
Then split the narration into ${wantScenes} sequential scenes that tell ONE continuous, coherent story
(clear cause-and-effect, same characters throughout).
For each scene: narration (1 sentence in ${langName(lang)}), on_screen_text (a few words, optional),
and "action" = ENGLISH description of what happens visually in THIS scene (pose, camera, mood) —
do NOT re-describe the character's fixed look, that is handled by the character sheet.
Return JSON: {"characters":"...","setting":"...","scenes":[{"narration","on_screen_text","action"}]}`,
        `Title: ${title}\nVisual genre: ${genre}\nNarration:\n${script}`,
        { temperature: 0.6 }
      );
      const raw = (out.scenes || []).slice(0, 10);
      if (raw.length) {
        return {
          provider: "openai",
          scenes: build(raw, variantId, style, targetSeconds, out.characters || "", out.setting || ""),
        };
      }
    } catch {
      /* fallback */
    }
  }

  // Mock: chia câu.
  const sentences = script.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean).slice(0, 10);
  const raw = (sentences.length ? sentences : [script]).map((s) => ({
    narration: s,
    on_screen_text: "",
    action: s,
  }));
  return { provider: "mock", scenes: build(raw, variantId, style, targetSeconds, "", "") };
}

function build(
  raw: { narration: string; on_screen_text?: string; action?: string; image_prompt?: string }[],
  variantId: string,
  style: string,
  targetSeconds: number,
  characters: string,
  setting: string
): Scene[] {
  const total = raw.reduce((s, r) => s + estimateSpeechSeconds(r.narration), 0) || 1;
  const charBible = characters ? `Main character (keep IDENTICAL every frame): ${characters}. ` : "";
  const world = setting ? `Setting/art direction (consistent): ${setting}. ` : "";
  let t = 0;
  return raw.map((r, i) => {
    const dur = Math.max(2, (estimateSpeechSeconds(r.narration) / total) * targetSeconds);
    const start = Math.round(t * 100) / 100;
    t += dur;
    const action = r.action || r.image_prompt || r.narration;
    return {
      id: uid("scene"),
      variant_id: variantId,
      order: i,
      narration: r.narration,
      purpose: i === 0 ? "Mở đầu" : i === raw.length - 1 ? "Kết thúc" : "Diễn biến",
      visual_intent: action,
      // Nhồi hồ sơ nhân vật + bối cảnh cố định vào MỌI khung → nhân vật đồng nhất.
      image_prompt:
        `${charBible}${world}This scene: ${action}. ${style}. ` +
        `Keep the exact same character design, colors and art style as the other frames of this film. ` +
        `Vertical 9:16 cinematic composition, no text, no watermark, no letterboxing`,
      asset_type: "image",
      asset_id: null,
      search_queries: [],
      start_time: start,
      end_time: Math.round(t * 100) / 100,
      on_screen_text: r.on_screen_text || "",
      effect: "kenburns",
      transition: "cut",
      priority: "high",
      scene_voice_match_score: 0.9,
    };
  });
}
