"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { shouldCountPath } from "@/lib/site-traffic-path";

export function TrafficBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!shouldCountPath(pathname)) return;
    const body = JSON.stringify({ path: pathname });
    const url = "/api/traffic/collect";
    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(url, blob)) return;
      }
    } catch {
      // Fall through to fetch. A failed beacon must not affect the page.
    }
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {
      // Ignore network errors — traffic recording must not break the page.
    });
  }, [pathname]);

  return null;
}
