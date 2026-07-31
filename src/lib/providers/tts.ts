import { config } from "../config";
import { tts as openaiTts } from "./openai";
import { estimateSpeechSeconds } from "../util";

export interface VoiceOptions {
  gender?: "male" | "female";
  style?: "expert" | "story" | "news" | "sales" | "friendly";
  speed?: number;
  voice?: string; // id giọng của provider
}

export interface VoiceResult {
  provider: "openai" | "elevenlabs" | "mock";
  audio: Buffer | null; // null nếu mock (chưa có audio thật)
  mime: string;
  estimated_seconds: number;
}

// Map style -> giọng OpenAI mặc định.
const OPENAI_VOICE: Record<string, string> = {
  expert: "onyx",
  story: "fable",
  news: "echo",
  sales: "nova",
  friendly: "alloy",
};

export async function synthesizeVoice(text: string, opts: VoiceOptions = {}): Promise<VoiceResult> {
  const estimated = estimateSpeechSeconds(text);

  if (config.tts.provider === "openai" && config.openai.key) {
    const voice = opts.voice || OPENAI_VOICE[opts.style || "friendly"] || "alloy";
    const audio = await openaiTts(text, voice);
    return { provider: "openai", audio, mime: "audio/mpeg", estimated_seconds: estimated };
  }

  if (config.tts.provider === "elevenlabs" && config.tts.elevenKey) {
    const voiceId = opts.voice || "21m00Tcm4TlvDq8ikWAM"; // Rachel (mặc định public)
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": config.tts.elevenKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
    const audio = Buffer.from(await res.arrayBuffer());
    return { provider: "elevenlabs", audio, mime: "audio/mpeg", estimated_seconds: estimated };
  }

  // Mock: không tạo audio thật, chỉ ước lượng thời lượng để đo nhịp kịch bản.
  return { provider: "mock", audio: null, mime: "audio/mpeg", estimated_seconds: estimated };
}
