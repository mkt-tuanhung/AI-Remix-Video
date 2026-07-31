import { promises as fs } from "node:fs";
import path from "node:path";
import { runFfmpeg, probeDuration } from "./ffmpeg";

// Nhạc nền + music ducking (đặc tả 8.17).
// - AI bed: tổng hợp một lớp pad êm bằng ffmpeg (do hệ thống tạo, không vướng bản quyền).
// - Ducking: sidechaincompress — voice làm sidechain hạ nhạc khi có thoại.

/** Sinh một lớp nhạc nền pad êm dịu dài `dur` giây. */
export async function generateAiBed(dur: number, outPath: string): Promise<string> {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const D = Math.max(4, Math.ceil(dur) + 1);
  // Hợp âm Am9 (A-C-E-B) sine, tremolo nhẹ, lowpass cho ấm, hạ âm lượng nền.
  await runFfmpeg([
    "-y",
    "-f", "lavfi", "-i", `sine=frequency=220:duration=${D}`,
    "-f", "lavfi", "-i", `sine=frequency=261.63:duration=${D}`,
    "-f", "lavfi", "-i", `sine=frequency=329.63:duration=${D}`,
    "-f", "lavfi", "-i", `sine=frequency=493.88:duration=${D}`,
    "-filter_complex",
    "[0][1][2][3]amix=inputs=4:normalize=1,tremolo=f=0.18:d=0.35,lowpass=f=900,aformat=sample_rates=44100:channel_layouts=stereo,afade=t=in:st=0:d=1.5,afade=t=out:st=" +
      (D - 1.5) + ":d=1.5,volume=-3dB",
    "-c:a", "aac", "-b:a", "128k",
    outPath,
  ]);
  return outPath;
}

export interface MixParams {
  musicGainDb: number; // âm lượng nền cơ bản (vd -18)
  duckingReductionDb: number; // mức hạ khi có thoại (vd 15)
  attackMs: number;
  releaseMs: number;
}

/**
 * Trộn voice + music với sidechain ducking. Voice luôn là lớp chính.
 * Trả về đường dẫn file audio đã mix (.m4a).
 */
export async function mixVoiceMusic(
  voicePath: string,
  musicPath: string,
  outPath: string,
  p: MixParams
): Promise<string> {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const voiceDur = (await probeDuration(voicePath)) ?? 30;
  // ratio suy ra từ mức giảm mong muốn; threshold thấp để bắt thoại.
  const ratio = Math.max(2, Math.min(20, Math.round(p.duckingReductionDb / 2)));

  // [music] hạ nền -> sidechaincompress với sidechain=voice -> amix với voice.
  // Lưu ý: một label filter chỉ được tiêu thụ 1 lần → phải asplit voice thành 2 nhánh.
  const filter =
    `[0:a]aformat=sample_rates=44100:channel_layouts=stereo,asplit=2[v1][v2];` +
    `[1:a]volume=${p.musicGainDb}dB,aformat=sample_rates=44100:channel_layouts=stereo[music];` +
    `[music][v1]sidechaincompress=threshold=0.03:ratio=${ratio}:attack=${p.attackMs}:release=${p.releaseMs}:makeup=1[duck];` +
    `[v2][duck]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[mix]`;

  await runFfmpeg([
    "-y",
    "-i", voicePath,
    "-stream_loop", "-1", "-i", musicPath,
    "-filter_complex", filter,
    "-map", "[mix]",
    "-t", String(voiceDur),
    "-c:a", "aac", "-b:a", "160k",
    outPath,
  ]);
  return outPath;
}
