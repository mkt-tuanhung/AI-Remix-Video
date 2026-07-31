// Worker độc lập (tuỳ chọn): rút cạn hàng đợi theo chu kỳ.
// Trong dev, UI đã tự gọi /api/worker/tick nên script này không bắt buộc.
// Dùng khi muốn tách worker khỏi web (đặc tả 15.3): `npm run worker`.

import { promises as fs } from "node:fs";
import path from "node:path";

async function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    try {
      const raw = await fs.readFile(path.join(process.cwd(), name), "utf8");
      for (const line of raw.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch {
      /* file có thể không tồn tại */
    }
  }
}

async function main() {
  await loadEnv();
  const { drainQueue } = await import("../src/lib/orchestrator/worker");
  console.log("[worker] khởi động, poll mỗi 2s. Ctrl+C để dừng.");
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await drainQueue();
    } catch (e) {
      console.error("[worker] lỗi:", e);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

main();
