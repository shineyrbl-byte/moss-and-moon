"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Counts a page view (once per page, no cookies). Respects "Do Not Track". */
export default function StatsBeacon() {
  const path = usePathname();
  const first = useRef(true);
  useEffect(() => {
    try {
      if (navigator.doNotTrack === "1") return;
      // Only the first page of a visit carries where the visitor came from
      const body = JSON.stringify({ path, ref: first.current ? document.referrer : "" });
      first.current = false;
      if (navigator.sendBeacon) navigator.sendBeacon("/api/stats", new Blob([body], { type: "application/json" }));
      else void fetch("/api/stats", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    } catch {}
  }, [path]);
  return null;
}
