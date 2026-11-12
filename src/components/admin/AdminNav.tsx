"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/workspaces", label: "Workspaces" },
  { href: "/admin/traffic", label: "Traffic" },
  { href: "/admin/settings", label: "Site settings" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <aside className="admin-nav panel p-3">
      <p className="admin-nav__title">Admin</p>
      <nav className="flex flex-col gap-1">
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={active ? "admin-nav__link admin-nav__link--active" : "admin-nav__link"}
              aria-current={active ? "page" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
