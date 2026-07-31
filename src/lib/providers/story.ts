import type { DialogueLine, Scene, StoryCharacter, StoryGenre } from "../types";
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
  characters: StoryCharacter[];
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
  // Mỗi cảnh ~8s để VỪA giới hạn 10s/clip của Veo/Flow.
  const wantScenes = Math.max(3, Math.min(12, Math.ceil(targetSeconds / 8)));

  if (hasOpenAI() && script.trim()) {
    try {
      const out = await chatJSON<{ characters: any; character_bible?: string; setting: string; scenes: any[] }>(
        `You are a film director. Write a coherent multi-character short film.
"characters" = array of {name, description} — each description is a FIXED visual look (species, colors,
clothing, features) kept identical across all scenes. Include a "Narrator" only if needed.
"setting" = consistent world / art direction / color palette.
Split into ${wantScenes} sequential scenes telling ONE continuous story (clear cause-and-effect).
For each scene:
 - narration: 1 sentence in ${langName(lang)} (caption text)
 - action: ENGLISH visual action for THIS scene (what characters DO, camera, mood)
 - dialogue: array of {speaker, text} — actual spoken lines by characters IN ${langName(lang)} (can be empty)
 - sfx: ENGLISH short description of ambient sound & sound effects for this scene
 - on_screen_text: optional few words
Return JSON: {"characters":[{"name","description"}],"setting":"...","scenes":[{"narration","action","dialogue":[{"speaker","text"}],"sfx","on_screen_text"}]}`,
        `Title: ${title}\nVisual genre: ${genre}\nStory:\n${script}`,
        { temperature: 0.6 }
      );
      const raw = (out.scenes || []).slice(0, 10);
      const chars = normalizeChars(out.characters);
      if (raw.length) {
        return {
          provider: "openai",
          characters: chars,
          scenes: build(raw, variantId, style, targetSeconds, chars, out.setting || ""),
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
    dialogue: [],
    sfx: "",
  }));
  return { provider: "mock", characters: [], scenes: build(raw, variantId, style, targetSeconds, [], "") };
}

function normalizeChars(c: any): StoryCharacter[] {
  if (Array.isArray(c)) {
    return c
      .filter((x) => x && (x.name || x.description))
      .map((x) => ({ name: String(x.name || "Character"), description: String(x.description || "") }))
      .slice(0, 8);
  }
  if (typeof c === "string" && c.trim()) return [{ name: "Main", description: c.trim() }];
  return [];
}

function build(
  raw: { narration: string; on_screen_text?: string; action?: string; dialogue?: any[]; sfx?: string; image_prompt?: string }[],
  variantId: string,
  style: string,
  targetSeconds: number,
  characters: StoryCharacter[],
  setting: string
): Scene[] {
  const total = raw.reduce((s, r) => s + estimateSpeechSeconds(r.narration), 0) || 1;
  const charBible = characters.length
    ? "Characters (keep IDENTICAL every scene): " + characters.map((c) => `${c.name} — ${c.description}`).join("; ") + ". "
    : "";
  const world = setting ? `Setting/art direction (consistent): ${setting}. ` : "";
  let t = 0;
  return raw.map((r, i) => {
    const dur = Math.max(2, (estimateSpeechSeconds(r.narration) / total) * targetSeconds);
    const start = Math.round(t * 100) / 100;
    t += dur;
    const action = r.action || r.image_prompt || r.narration;
    const dialogue: DialogueLine[] = Array.isArray(r.dialogue)
      ? r.dialogue.filter((d) => d && d.text).map((d) => ({ speaker: String(d.speaker || "Narrator"), text: String(d.text) }))
      : [];
    const dlgText = dialogue.map((d) => `${d.speaker} says: "${d.text}"`).join(" ");
    const sfx = r.sfx ? `Ambient sound and sound effects: ${r.sfx}.` : "";
    return {
      id: uid("scene"),
      variant_id: variantId,
      order: i,
      narration: r.narration,
      purpose: i === 0 ? "Mở đầu" : i === raw.length - 1 ? "Kết thúc" : "Diễn biến",
      visual_intent: action,
      image_prompt:
        `${charBible}${world}This scene: ${action}. ${style}. ` +
        `Keep the exact same character design, colors and art style as the other frames of this film. ` +
        `Vertical 9:16 cinematic composition, no text, no watermark, no letterboxing`,
      // Prompt sẵn để dán vào Veo/Flow (clip ~8s): nhân vật nhất quán + hành động + THOẠI + SFX.
      // KHÔNG để Veo thêm nhạc nền (app sẽ phủ 1 dải nhạc liên tục) → âm thanh liền mạch giữa các clip.
      veo_prompt:
        `${charBible}${world}Scene ${i + 1}, about 8 seconds. Animate: ${action}. ` +
        `${dlgText ? "Spoken dialogue — " + dlgText + " " : ""}${sfx} ` +
        `${style}. Continue naturally and consistently from the provided reference image; ` +
        `keep the SAME character design, colors, lighting and setting as the reference. Smooth cinematic camera. ` +
        `Vertical 9:16, high quality, natural spoken dialogue and diegetic sound effects ONLY — do NOT add any background music.`,
      dialogue,
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
