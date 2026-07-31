import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <div className="topbar"><h1>Không tìm thấy</h1></div>
      <div className="content">
        <div className="empty">
          <div className="empty-emoji">🔍</div>
          <div style={{ fontWeight: 600, color: "var(--ink-700)", marginBottom: 6 }}>
            Trang hoặc dự án không tồn tại
          </div>
          <Link href="/" className="btn btn-primary" style={{ marginTop: 12 }}>Về bảng điều khiển</Link>
        </div>
      </div>
    </>
  );
}
