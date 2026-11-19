"use client";

import type { AdminSortDir, AdminSortState } from "@/lib/admin-workspaces-sort";

type AdminSortButtonProps<K extends string> = {
  label: string;
  sortKey: K;
  current: AdminSortState<K>;
  onClick: (key: K) => void;
};

export function AdminSortButton<K extends string>({
  label,
  sortKey,
  current,
  onClick,
}: AdminSortButtonProps<K>) {
  const active = current.key === sortKey;
  const dir: AdminSortDir | undefined = active ? current.dir : undefined;
  return (
    <button
      type="button"
      className={`admin-sort-btn${active ? " admin-sort-btn--active" : ""}`}
      aria-pressed={active}
      aria-label={
        active
          ? `Sort by ${label}, currently ${dir === "asc" ? "ascending" : "descending"}`
          : `Sort by ${label}`
      }
      onClick={() => onClick(sortKey)}
    >
      {label}
      {active ? (
        <span className="admin-sort-btn__indicator" aria-hidden="true">
          {dir === "asc" ? "↑" : "↓"}
        </span>
      ) : null}
    </button>
  );
}

export function adminSortAria(active: boolean, dir: AdminSortDir | undefined): "ascending" | "descending" | "none" {
  if (!active || !dir) return "none";
  return dir === "asc" ? "ascending" : "descending";
}
