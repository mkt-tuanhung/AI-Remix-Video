import type { Entity, Fact, Shot } from "../types";
import { chatJSON, hasOpenAI } from "./openai";
import { seededPick } from "../util";

export interface ContentUnderstanding {
  provider: "openai" | "mock";
  main_topic: string;
  entities: Entity[];
  facts: Fact[];
  uncertain_claims: string[];
  source_hook: string;
  source_cta: string;
  conflicts: string[];
}

const SYSTEM = `Bạn là biên tập viên nội dung video. Đọc transcript và danh sách mô tả cảnh, rồi phân tích.
Nhiệm vụ: xác định chủ đề chính, thực thể (người/địa điểm/thương hiệu/sản phẩm/số liệu), lập bản đồ dữ kiện
(phân loại confirmed/opinion/inferred/uncertain/needs_check), hook mở đầu của bản gốc, CTA của bản gốc,
và những điểm mà LỜI và HÌNH có vẻ mâu thuẫn.
Trả JSON: {"main_topic":str,"entities":[{"name":str,"type":str}],"facts":[{"text":str,"kind":str}],
"uncertain_claims":[str],"source_hook":str,"source_cta":str,"conflicts":[str]}`;

export async function understandContent(
  transcript: string,
  shots: Shot[]
): Promise<ContentUnderstanding> {
  if (hasOpenAI() && transcript.trim()) {
    try {
      const shotSummary = shots
        .map((s) => `- [${s.start_time}-${s.end_time}s] ${s.description}`)
        .join("\n");
      const out = await chatJSON<any>(
        SYSTEM,
        `TRANSCRIPT:\n${transcript}\n\nCÁC CẢNH:\n${shotSummary}`,
        { temperature: 0.4 }
      );
      return {
        provider: "openai",
        main_topic: out.main_topic || "",
        entities: (out.entities || []).map((e: any) => ({
          name: e.name,
          type: normalizeEntityType(e.type),
        })),
        facts: (out.facts || []).map((f: any) => ({
          text: f.text,
          kind: normalizeFactKind(f.kind),
          locked: normalizeFactKind(f.kind) === "confirmed",
        })),
        uncertain_claims: out.uncertain_claims || [],
        source_hook: out.source_hook || "",
        source_cta: out.source_cta || "",
        conflicts: out.conflicts || [],
      };
    } catch {
      // rơi xuống mock
    }
  }
  return mockUnderstanding(transcript, shots);
}

function normalizeEntityType(t: string): Entity["type"] {
  const v = (t || "").toLowerCase();
  const allowed = ["person", "place", "brand", "product", "number", "date", "event"];
  return (allowed.includes(v) ? v : "other") as Entity["type"];
}

function normalizeFactKind(k: string): Fact["kind"] {
  const v = (k || "").toLowerCase();
  const allowed = ["confirmed", "opinion", "inferred", "uncertain", "needs_check"];
  return (allowed.includes(v) ? v : "inferred") as Fact["kind"];
}

const TOPICS = [
  "Chia sẻ kinh nghiệm làm việc hiệu quả",
  "Mẹo cải thiện thói quen hằng ngày",
  "Giới thiệu một quy trình đơn giản mà hiệu quả",
  "Bài học rút ra sau thời gian trải nghiệm",
];

function mockUnderstanding(transcript: string, shots: Shot[]): ContentUnderstanding {
  const seed = transcript.slice(0, 40) || "seed";
  const topic = seededPick(seed, TOPICS);
  const people = Array.from(new Set(shots.flatMap((s) => s.people)));
  const objects = Array.from(new Set(shots.flatMap((s) => s.objects))).slice(0, 5);
  const sentences = transcript.split(/(?<=[.!?])\s+/).filter(Boolean);

  const entities: Entity[] = [
    ...people.map((p) => ({ name: p, type: "person" as const })),
    ...objects.map((o) => ({ name: o, type: "product" as const })),
    { name: "7 ngày", type: "number" as const },
  ];

  const facts: Fact[] = sentences.slice(0, 5).map((text, i) => ({
    text,
    kind: (i === 0 ? "confirmed" : i % 2 ? "inferred" : "opinion") as Fact["kind"],
    locked: i === 0,
  }));

  return {
    provider: "mock",
    main_topic: topic,
    entities,
    facts,
    uncertain_claims: sentences.length > 5 ? [sentences[5]] : [],
    source_hook: sentences[0] || "",
    source_cta: sentences[sentences.length - 1] || "",
    conflicts: [],
  };
}
