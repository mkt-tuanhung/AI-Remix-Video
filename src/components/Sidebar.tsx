"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CapabilityPills } from "./CapabilityPills";

const NAV = [
  { href: "/", label: "Bảng điều khiển", icon: "◫" },
  { href: "/projects/new", label: "Tạo dự án", icon: "＋" },
  { href: "/batch/new", label: "Xử lý hàng loạt", icon: "▤" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <Link href="/" className="brand">
        <div className="brand-mark">✦</div>
        <div>
          <div className="brand-name">AI Remix Video</div>
          <div className="brand-sub">Tái sản xuất nội dung</div>
        </div>
      </Link>

      {NAV.map((n) => {
        const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} className={`nav-item ${active ? "active" : ""}`}>
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </Link>
        );
      })}

      <div className="sidebar-foot">
        <CapabilityPills />
      </div>
    </aside>
  );
}
