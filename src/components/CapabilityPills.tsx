"use client";

import { useEffect, useState } from "react";

type Caps = Record<string, string>;

const LABELS: Record<string, string> = {
  transcription: "Transcript",
  vision: "Vision",
  llm: "Kịch bản",
  tts: "Voice",
  stock: "Stock",
  store: "Lưu trữ",
};

export function CapabilityPills() {
  const [caps, setCaps] = useState<Caps | null>(null);

  useEffect(() => {
    fetch("/api/capabilities")
      .then((r) => r.json())
      .then((d) => setCaps(d.capabilities))
      .catch(() => {});
  }, []);

  if (!caps) return null;

  return (
    <div className="card card-pad" style={{ padding: 14 }}>
      <div className="section-title" style={{ marginBottom: 10 }}>Nhà cung cấp</div>
      <div className="stack" style={{ gap: 7 }}>
        {Object.entries(caps).map(([k, v]) => {
          const isMock = v === "mock";
          return (
            <div key={k} className="row between" style={{ fontSize: 12.5 }}>
              <span className="muted">{LABELS[k] ?? k}</span>
              <span className={`badge ${isMock ? "badge-gray" : "badge-green"}`} style={{ padding: "1px 8px", fontSize: 11 }}>
                {v}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
