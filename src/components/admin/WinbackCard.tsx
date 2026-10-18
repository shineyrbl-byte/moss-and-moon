"use client";
import { useEffect, useState } from "react";

type S = { on: boolean; sent: number; back: number; waiting: number; rules: { afterDays: number; off: number; validDays: number } };

/** Owner: "we miss you" emails for regulars who've stopped coming */
export default function WinbackCard() {
  const [s, setS] = useState<S | null>(null);
  useEffect(() => { fetch("/api/admin/winback").then((r) => (r.ok ? r.json() : null)).then(setS).catch(() => {}); }, []);
  if (!s) return null;
  async function toggle() {
    const r = await fetch("/api/admin/winback", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on: !s!.on }) });
    if (r.ok) setS(await r.json());
  }
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
      <div className="toggle-row">
        <b>💌 “We miss you” emails</b>
        <button className={`switch ${s.on ? "" : "off"}`} onClick={toggle} aria-pressed={s.on} aria-label="We miss you emails on" />
      </div>
      <p className="small muted">Regulars (2+ orders) who haven&apos;t ordered for {s.rules.afterDays} days get a friendly email with {s.rules.off}% off, valid {s.rules.validDays} days. At most one every 3 months, and guests can unsubscribe.</p>
      <p className="small">Last 90 days: <b>{s.sent}</b> sent · <b>{s.back}</b> came back{s.sent ? ` (${Math.round((s.back / s.sent) * 100)}%)` : ""} · {s.waiting} due to get one{s.on ? " soon" : " when switched on"}</p>
    </section>
  );
}
