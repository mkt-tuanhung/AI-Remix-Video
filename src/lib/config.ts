// Cấu hình runtime + phát hiện năng lực provider từ env.
// Nguyên tắc: thiếu key nào -> phần đó chạy mock, hệ thống vẫn end-to-end.

export const config = {
  store: (process.env.STORE_DRIVER || "fs") as "fs" | "supabase",

  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },

  openai: {
    key: process.env.OPENAI_API_KEY || "",
    llmModel: process.env.OPENAI_LLM_MODEL || "gpt-4o-mini",
    visionModel: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
    transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1",
    ttsModel: process.env.OPENAI_TTS_MODEL || "tts-1",
  },

  tts: {
    provider: (process.env.TTS_PROVIDER || "openai") as "openai" | "elevenlabs" | "mock",
    elevenKey: process.env.ELEVENLABS_API_KEY || "",
  },

  stock: {
    provider: (process.env.STOCK_PROVIDER || "pexels") as "pexels" | "pixabay" | "mock",
    pexelsKey: process.env.PEXELS_API_KEY || "",
    pixabayKey: process.env.PIXABAY_API_KEY || "",
  },

  ffmpeg: {
    ffmpeg: process.env.FFMPEG_PATH || resolveFfmpegStatic() || "ffmpeg",
    ffprobe: process.env.FFPROBE_PATH || resolveFfprobeStatic() || "ffprobe",
  },
};

// Ưu tiên binary đóng gói theo dự án (ffmpeg-static / ffprobe-static) để render
// chạy được ngay không cần cài ffmpeg hệ thống. Env override vẫn được tôn trọng.
function resolveFfmpegStatic(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const p = require("ffmpeg-static");
    return typeof p === "string" ? p : null;
  } catch {
    return null;
  }
}

function resolveFfprobeStatic(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const p = require("ffprobe-static");
    return p?.path ?? null;
  } catch {
    return null;
  }
}

/** Năng lực thực tế đang bật — hiển thị lên UI để người dùng biết đang chạy thật hay mock. */
export function capabilities() {
  const hasOpenAI = !!config.openai.key;
  const hasTts =
    (config.tts.provider === "openai" && hasOpenAI) ||
    (config.tts.provider === "elevenlabs" && !!config.tts.elevenKey);
  const hasStock =
    (config.stock.provider === "pexels" && !!config.stock.pexelsKey) ||
    (config.stock.provider === "pixabay" && !!config.stock.pixabayKey);

  return {
    transcription: hasOpenAI ? "openai" : "mock",
    vision: hasOpenAI ? "openai" : "mock",
    llm: hasOpenAI ? "openai" : "mock",
    tts: hasTts ? config.tts.provider : "mock",
    stock: hasStock ? config.stock.provider : "mock",
    store: config.store,
  } as const;
}
