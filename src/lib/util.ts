import { createHash, randomUUID } from "node:crypto";

export function uid(prefix = "id"): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function sha256(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** Hash tất định từ chuỗi -> [0,1). Dùng để mock cho ổn định (không random). */
export function seededUnit(seed: string): number {
  const h = createHash("sha256").update(seed).digest();
  const n = h.readUInt32BE(0);
  return n / 0xffffffff;
}

/** Chọn tất định 1 phần tử từ mảng theo seed. */
export function seededPick<T>(seed: string, arr: T[]): T {
  return arr[Math.floor(seededUnit(seed) * arr.length) % arr.length];
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Ước lượng thời lượng đọc (giây) từ text tiếng Việt ~ 2.6 từ/giây. */
export function estimateSpeechSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round((words / 2.6) * 10) / 10;
}
