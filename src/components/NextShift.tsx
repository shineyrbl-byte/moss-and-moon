"use client";
import { useEffect, useState } from "react";
import { fmtTime } from "@/lib/rota";
import { toDateStr } from "@/lib/cafe";

/** "Your next shift: Tue 7am–1pm" for the signed-in barista */
export default function NextShift() {
  const [next, setNext] = useState<{ day: string; start: string; end: string } | null>(null);
  useEffect(() => {
    fetch("/api/admin/shifts").then((r) => (r.ok ? r.json() : null)).then((d) => d?.next && setNext(d.next)).catch(() => {});
  }, []);
  if (!next) return null;
  const day = next.day === toDateStr(new Date()) ? "today" : new Date(next.day + "T12:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  return <span className="next-shift muted">🗓 Your next shift: <b>{day}, {fmtTime(next.start)}–{fmtTime(next.end)}</b></span>;
}
