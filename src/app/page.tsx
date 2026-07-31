import Link from "next/link";
import { dashboardStats, listProjects } from "@/lib/services";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

const PLATFORM_LABEL: Record<string, string> = {
  tiktok: "TikTok",
  instagram_reels: "Reels",
  youtube_shorts: "Shorts",
  facebook_reels: "FB Reels",
  custom: "Tuỳ chỉnh",
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function Dashboard() {
  const [stats, projects] = await Promise.all([dashboardStats(), listProjects()]);

  const tiles = [
    { label: "Tổng dự án", value: stats.total, accent: false, foot: "tất cả thời gian" },
    { label: "Đang xử lý", value: stats.processing, accent: true, foot: "trong pipeline" },
    { label: "Hoàn thành", value: stats.completed, accent: false, foot: "đã render" },
    { label: "Hàng đợi", value: stats.queuePending + stats.queueRunning, accent: false, foot: `${stats.queueRunning} đang chạy` },
  ];

  return (
    <>
      <div className="topbar">
        <h1>Bảng điều khiển</h1>
        <Link href="/projects/new" className="btn btn-primary btn-sm">＋ Dự án mới</Link>
      </div>

      <div className="content">
        <div className="grid grid-4" style={{ marginBottom: 26 }}>
          {tiles.map((t) => (
            <div key={t.label} className="card stat">
              <div className="stat-label">{t.label}</div>
              <div className={`stat-value ${t.accent ? "accent" : ""}`}>{t.value}</div>
              <div className="stat-foot">{t.foot}</div>
            </div>
          ))}
        </div>

        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Dự án gần đây</h2>
          {stats.failed > 0 && (
            <span className="badge badge-red"><span className="dot" />{stats.failed} dự án lỗi</span>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="empty">
            <div className="empty-emoji">🎬</div>
            <div style={{ fontWeight: 600, color: "var(--ink-700)", marginBottom: 6 }}>
              Chưa có dự án nào
            </div>
            <div style={{ marginBottom: 18 }}>
              Tải một video nguồn để bắt đầu dây chuyền tái sản xuất nội dung.
            </div>
            <Link href="/projects/new" className="btn btn-primary">Tạo dự án đầu tiên</Link>
          </div>
        ) : (
          <div className="card">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Tên dự án</th>
                  <th>Mục tiêu</th>
                  <th>Nền tảng</th>
                  <th>Thời lượng</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/projects/${p.id}`} style={{ fontWeight: 600, color: "var(--teal-700)" }}>
                        {p.title}
                      </Link>
                    </td>
                    <td className="muted">{p.goal}</td>
                    <td className="muted">
                      {p.target_platforms.map((pl) => PLATFORM_LABEL[pl] ?? pl).join(", ")}
                    </td>
                    <td className="muted">{p.target_duration_seconds}s · {p.aspect_ratio}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td className="muted">{fmtDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
