"use client";
import { useEffect, useState } from "react";

type S = { on: boolean; sent: number; back: number; waiting: number; rules: { afterDays: number; off: number; validDays: number }; anniversary: { on: boolean; sent: number } };

/** Owner: "we miss you" emails for regulars who've stopped coming */
export default function WinbackCard() {
  const [s, setS] = useState<S | null>(null);
  useEffect(() => { fetch("/api/admin/winback").then((r) => (r.ok ? r.json() : null)).then(setS).catch(() => {}); }, []);
  if (!s) return null;
  async function put(body: object) {
    const r = await fetch("/api/admin/winback", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) setS(await r.json());
  }
  const toggle = () => put({ on: !s!.on });
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
      <div className="toggle-row">
        <b>💌 “We miss you” emails</b>
        <button className={`switch ${s.on ? "" : "off"}`} onClick={toggle} aria-pressed={s.on} aria-label="We miss you emails on" />
      </div>
      <p className="small muted">Regulars (2+ orders) who haven&apos;t ordered for {s.rules.afterDays} days get a friendly email with {s.rules.off}% off, valid {s.rules.validDays} days. At most one every 3 months, and guests can unsubscribe.</p>
      <div className="toggle-row" style={{ marginTop: "0.6rem" }}>
        <b>🌸 “A year with us” emails</b>
        <button className={`switch ${s.anniversary.on ? "" : "off"}`} onClick={() => put({ anniversary: !s.anniversary.on })} aria-pressed={s.anniversary.on} aria-label="Anniversary emails on" />
      </div>
      <p className="small muted">On the anniversary of their account, guests with 3+ orders that year get their year in coffee (visits, drinks, favourite) and 20% off. {s.anniversary.sent} sent in the last 90 days.</p>
      <p className="small">Win-back, last 90 days: <b>{s.sent}</b> sent · <b>{s.back}</b> came back{s.sent ? ` (${Math.round((s.back / s.sent) * 100)}%)` : ""} · {s.waiting} due to get one{s.on ? " soon" : " when switched on"}</p>
    </section>
  );
}
