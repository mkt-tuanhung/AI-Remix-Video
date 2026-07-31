import type { Scene } from "./types";

// Sinh phụ đề SRT/VTT từ timing các cảnh (đã refit theo voice thật).
// Phụ đề burn vào video được vẽ bằng drawtext trong renderer (không cần libass).

function ts(t: number, sep: "," | "."): string {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const ms = Math.round((t - Math.floor(t)) * 1000);
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(h)}:${p(m)}:${p(s)}${sep}${p(ms, 3)}`;
}

export function buildSRT(scenes: Scene[]): string {
  return scenes
    .map((sc, i) => `${i + 1}\n${ts(sc.start_time, ",")} --> ${ts(sc.end_time, ",")}\n${sc.narration}\n`)
    .join("\n");
}

export function buildVTT(scenes: Scene[]): string {
  const body = scenes
    .map((sc) => `${ts(sc.start_time, ".")} --> ${ts(sc.end_time, ".")}\n${sc.narration}`)
    .join("\n\n");
  return `WEBVTT\n\n${body}\n`;
}
