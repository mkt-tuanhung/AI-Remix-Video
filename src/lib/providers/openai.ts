import { config } from "../config";

// Helper gọi OpenAI REST bằng fetch (không cần SDK). Chỉ dùng khi có key.

const BASE = "https://api.openai.com/v1";

export function hasOpenAI(): boolean {
  return !!config.openai.key;
}

export async function chatJSON<T = any>(
  system: string,
  user: string,
  opts: { model?: string; temperature?: number } = {}
): Promise<T> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openai.key}`,
    },
    body: JSON.stringify({
      model: opts.model || config.openai.llmModel,
      temperature: opts.temperature ?? 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI chat ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content) as T;
}

/** Vision: gửi ảnh (data URL base64) + prompt, nhận JSON. */
export async function visionJSON<T = any>(
  system: string,
  user: string,
  imageDataUrls: string[],
  opts: { model?: string } = {}
): Promise<T> {
  const content: any[] = [{ type: "text", text: user }];
  for (const url of imageDataUrls) {
    content.push({ type: "image_url", image_url: { url, detail: "low" } });
  }
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openai.key}`,
    },
    body: JSON.stringify({
      model: opts.model || config.openai.visionModel,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI vision ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content) as T;
}

/** Whisper transcribe: nhận Buffer audio, trả verbose_json có segments. */
export async function transcribe(
  audio: Buffer,
  filename: string
): Promise<{ text: string; language: string; segments: any[] }> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)]), filename);
  form.append("model", config.openai.transcribeModel);
  form.append("response_format", "verbose_json");
  const res = await fetch(`${BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.openai.key}` },
    body: form,
  });
  if (!res.ok) throw new Error(`OpenAI transcribe ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return {
    text: data.text || "",
    language: data.language || "unknown",
    segments: data.segments || [],
  };
}

/** TTS: trả về Buffer mp3. */
export async function tts(text: string, voice = "alloy"): Promise<Buffer> {
  const res = await fetch(`${BASE}/audio/speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openai.key}`,
    },
    body: JSON.stringify({ model: config.openai.ttsModel, voice, input: text }),
  });
  if (!res.ok) throw new Error(`OpenAI tts ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}
