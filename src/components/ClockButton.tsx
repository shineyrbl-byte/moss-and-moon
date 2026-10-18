"use client";
import { useEffect, useState } from "react";
import { useStore } from "./Store";

/** Barista screen: clock in / clock out */
export default function ClockButton() {
  const { toast } = useStore();
  const [s, setS] = useState<{ canClock: boolean; clockedIn?: boolean; since?: string | null } | null>(null);
  const load = () => fetch("/api/staff/clock").then((r) => (r.ok ? r.json() : null)).then(setS).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!s?.canClock) return null;
  async function go() {
    const r = await fetch("/api/staff/clock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: s?.clockedIn ? "out" : "in" }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    toast(s?.clockedIn ? "Clocked out. Thanks for today ✿" : "Clocked in. Have a lovely shift ☕");
    load();
  }
  return (
    <button className={`chip ${s.clockedIn ? "on" : ""}`} onClick={go} aria-pressed={!!s.clockedIn}>
      {s.clockedIn ? `⏱ Clock out (in since ${s.since?.slice(11, 16)})` : "⏱ Clock in"}
    </button>
  );
}
