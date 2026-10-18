"use client";
import { useCallback, useEffect, useState } from "react";
import { rupees } from "@/lib/pricing";
import type { CafeEvent } from "@/lib/cafe";
import { useStore } from "../Store";

type T = { code: string; event_id: string; name: string; email: string; qty: number; amount: number; checked_in: number; checked_in_at: string | null };

/** Door list for paid events, with check-in */
export default function EventsTab() {
  const { toast } = useStore();
  const [data, setData] = useState<{ events: CafeEvent[]; tickets: T[] } | null>(null);
  const [code, setCode] = useState("");

  const load = useCallback(() => fetch("/api/tickets").then((r) => r.json()).then(setData).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  async function checkIn(c: string) {
    const r = await fetch(`/api/tickets/${encodeURIComponent(c.trim().toUpperCase())}`, { method: "PATCH" });
    const d = await r.json();
    toast(r.ok ? `✓ ${d.name}${d.qty > 1 ? ` (+${d.qty - 1})` : ""} checked in` : d.error);
    if (r.ok) setCode("");
    load();
  }

  if (!data) return <p className="muted">Loading…</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (code.trim()) checkIn(code); }}>
        <input className="input" style={{ flex: 1, maxWidth: 260 }} placeholder="Ticket code, e.g. TK-7KQ2M" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Ticket code" />
        <button className="btn btn-pink btn-sm">Check in</button>
      </form>
      <p className="small muted">Tip: guests can show the QR code on their ticket. Scan it with this phone&apos;s camera while signed in here, and tap “Check in”.</p>
      {data.events.map((ev) => {
        const list = data.tickets.filter((t) => t.event_id === ev.id);
        const sold = list.reduce((s, t) => s + t.qty, 0);
        const inside = list.filter((t) => t.checked_in).reduce((s, t) => s + t.qty, 0);
        return (
          <section key={ev.id} className="card" style={{ padding: "1.1rem 1.2rem" }}>
            <div className="sum-row">
              <h3 style={{ fontSize: "1.3rem" }}>{ev.title}</h3>
              <span className="small muted">{ev.date} · {ev.time}</span>
            </div>
            <p className="small muted" style={{ margin: "0.3rem 0 0.6rem" }}>{sold}/{ev.capacity} sold · {inside} checked in · {rupees(list.reduce((s, t) => s + t.amount, 0))}</p>
            {!list.length && <p className="small muted">No tickets yet.</p>}
            {list.map((t) => (
              <div key={t.code} className="sum-row small" style={{ padding: "0.4rem 0", borderTop: "1px solid var(--line)", alignItems: "center" }}>
                <span><b>{t.name}</b>{t.qty > 1 ? ` × ${t.qty}` : ""} <span className="muted">· {t.code}</span></span>
                {t.checked_in ? <span className="success">✓ {t.checked_in_at?.slice(11, 16)}</span> : <button className="btn btn-ghost btn-sm" onClick={() => checkIn(t.code)}>Check in</button>}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
