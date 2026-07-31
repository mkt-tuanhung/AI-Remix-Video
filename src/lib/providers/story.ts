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
      const out = await chatJSON<{ scenes: any[] }>(
        `You are a film storyboard artist. Split the narration into ${wantScenes} sequential scenes.
For each scene provide: narration (1 sentence in ${langName(lang)}), on_screen_text (a few words, optional),
and image_prompt: a rich ENGLISH prompt describing the visual for this exact moment
(characters, setting, action, mood, composition). Keep characters/world consistent across scenes.
Do NOT include the style words; they will be appended automatically.
Return JSON: {"scenes":[{"narration","on_screen_text","image_prompt"}]}`,
        `Title: ${title}\nVisual genre: ${genre}\nNarration:\n${script}`,
        { temperature: 0.7 }
      );
      const raw = (out.scenes || []).slice(0, 10);
      if (raw.length) return { provider: "openai", scenes: build(raw, variantId, style, targetSeconds) };
    } catch {
      /* fallback */
    }
  }

  // Mock: chia câu, prompt ảnh đơn giản.
  const sentences = script.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean).slice(0, 10);
  const raw = (sentences.length ? sentences : [script]).map((s) => ({
    narration: s,
    on_screen_text: "",
    image_prompt: s,
  }));
  return { provider: "mock", scenes: build(raw, variantId, style, targetSeconds) };
}

function build(
  raw: { narration: string; on_screen_text?: string; image_prompt?: string }[],
  variantId: string,
  style: string,
  targetSeconds: number
): Scene[] {
  const total = raw.reduce((s, r) => s + estimateSpeechSeconds(r.narration), 0) || 1;
  let t = 0;
  return raw.map((r, i) => {
    const dur = Math.max(2, (estimateSpeechSeconds(r.narration) / total) * targetSeconds);
    const start = Math.round(t * 100) / 100;
    t += dur;
    return {
      id: uid("scene"),
      variant_id: variantId,
      order: i,
      narration: r.narration,
      purpose: i === 0 ? "Mở đầu" : i === raw.length - 1 ? "Kết thúc" : "Diễn biến",
      visual_intent: r.image_prompt || r.narration,
      image_prompt: `${r.image_prompt || r.narration}. ${style}. vertical 9:16 composition, no text, no watermark`,
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
