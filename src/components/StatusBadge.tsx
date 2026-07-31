import type { ProjectStatus } from "@/lib/types";

const MAP: Record<string, { cls: string; label: string; pulse?: boolean }> = {
  DRAFT: { cls: "badge-gray", label: "Nháp" },
  UPLOADED: { cls: "badge-blue", label: "Đã tải video" },
  ANALYZING: { cls: "badge-teal", label: "Đang phân tích", pulse: true },
  WAITING_FOR_TRANSCRIPT_APPROVAL: { cls: "badge-amber", label: "Chờ duyệt transcript" },
  PLANNING_CONTENT: { cls: "badge-teal", label: "Lên kịch bản", pulse: true },
  WAITING_FOR_SCRIPT_APPROVAL: { cls: "badge-amber", label: "Chờ duyệt kịch bản" },
  BUILDING_STORYBOARD: { cls: "badge-teal", label: "Dựng storyboard", pulse: true },
  GENERATING_ASSETS: { cls: "badge-teal", label: "Tìm tài nguyên", pulse: true },
  GENERATING_VOICE: { cls: "badge-teal", label: "Tạo voice", pulse: true },
  MIXING_AUDIO: { cls: "badge-teal", label: "Phối âm", pulse: true },
  BUILDING_TIMELINE: { cls: "badge-teal", label: "Dựng timeline", pulse: true },
  RENDERING_PREVIEW: { cls: "badge-teal", label: "Render nháp", pulse: true },
  WAITING_FOR_MEDIA_APPROVAL: { cls: "badge-amber", label: "Chờ duyệt media" },
  QUALITY_CHECK: { cls: "badge-amber", label: "Bản nháp sẵn sàng" },
  REGENERATING: { cls: "badge-teal", label: "Tạo lại", pulse: true },
  RENDERING_FINAL: { cls: "badge-teal", label: "Render cuối", pulse: true },
  CREATING_VARIANTS: { cls: "badge-teal", label: "Tạo phiên bản", pulse: true },
  COMPLETED: { cls: "badge-green", label: "Hoàn thành" },
  FAILED: { cls: "badge-red", label: "Lỗi" },
  CANCELLED: { cls: "badge-gray", label: "Đã huỷ" },
};

export function StatusBadge({ status }: { status: ProjectStatus | string }) {
  const m = MAP[status] ?? { cls: "badge-gray", label: status };
  return (
    <span className={`badge ${m.cls}`}>
      <span className={`dot ${m.pulse ? "dot-pulse" : ""}`} />
      {m.label}
    </span>
  );
}
