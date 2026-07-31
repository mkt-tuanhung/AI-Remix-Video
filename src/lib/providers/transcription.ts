import { promises as fs } from "node:fs";
import path from "node:path";
import type { TranscriptSegment } from "../types";
import { extractAudio } from "../media/ffmpeg";
import { hasOpenAI, transcribe as whisper } from "./openai";
import { seededPick } from "../util";

export interface TranscriptionResult {
  provider: "openai" | "mock";
  language: string;
  transcript: string;
  segments: TranscriptSegment[];
}

// Câu mock tất định — dùng khi chưa cắm OpenAI, để pipeline vẫn chạy end-to-end.
const MOCK_SENTENCES = [
  "Hôm nay tôi sẽ chia sẻ với bạn một điều mà rất ít người để ý.",
  "Nghe thì đơn giản nhưng nó thay đổi hoàn toàn cách chúng ta làm việc.",
  "Điều đầu tiên bạn cần nhớ là luôn bắt đầu từ mục tiêu rõ ràng.",
  "Nhiều người bỏ cuộc chỉ vì họ không thấy kết quả ngay lập tức.",
  "Bí quyết nằm ở sự kiên trì và một quy trình lặp lại đều đặn.",
  "Hãy thử áp dụng trong bảy ngày và tự cảm nhận sự khác biệt.",
  "Nếu thấy hữu ích, đừng quên lưu lại video này để xem lại nhé.",
  "Cảm ơn bạn đã theo dõi, hẹn gặp lại ở nội dung tiếp theo.",
];

export async function runTranscription(
  videoPath: string,
  projectId: string
): Promise<TranscriptionResult> {
  // Đường đi thật: tách audio -> Whisper.
  if (hasOpenAI()) {
    const wav = path.join(path.dirname(videoPath), `${projectId}.wav`);
    const audioPath = await extractAudio(videoPath, wav);
    if (audioPath) {
      const buf = await fs.readFile(audioPath);
      const r = await whisper(buf, path.basename(audioPath));
      const segments: TranscriptSegment[] = (r.segments || []).map((s: any) => ({
        start: s.start,
        end: s.end,
        text: (s.text || "").trim(),
        confidence: typeof s.avg_logprob === "number" ? Math.exp(s.avg_logprob) : undefined,
      }));
      return {
        provider: "openai",
        language: r.language,
        transcript: r.text.trim(),
        segments: segments.length ? segments : mockSegments(projectId).segments,
      };
    }
    // Không tách được audio (thiếu ffmpeg) -> rơi xuống mock.
  }
  return mockSegments(projectId);
}

function mockSegments(seed: string): TranscriptionResult {
  const count = 6 + Math.floor((seed.length % 3));
  const segments: TranscriptSegment[] = [];
  let t = 0.5;
  for (let i = 0; i < count; i++) {
    const text = seededPick(`${seed}:${i}`, MOCK_SENTENCES);
    const dur = 3 + ((i * 7 + seed.charCodeAt(i % seed.length)) % 4);
    segments.push({
      start: Math.round(t * 10) / 10,
      end: Math.round((t + dur) * 10) / 10,
      text,
      speaker: "spk_1",
      confidence: 0.9,
    });
    t += dur + 0.3;
  }
  return {
    provider: "mock",
    language: "vi",
    transcript: segments.map((s) => s.text).join(" "),
    segments,
  };
}
