"use client";
import { useCallback, useEffect, useState } from "react";
import { rupees } from "@/lib/pricing";
import { useStore } from "../Store";

type C = { code: string; name: string; email: string; phone: string; event_date: string; event_time: string; guests: number; kind: string; method: string; address: string | null; details: string; status: string; amount: number | null; quote_note: string | null; pay_choice: string | null; paid_at: string | null };
const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const LABEL: Record<string, string> = { requested: "needs a quote", quoted: "quote sent", accepted: "confirmed · pay on the day", paid: "paid", done: "done", declined: "declined" };

/** Owner: catering requests, quotes and what's coming up */
export default function CateringTab() {
  const { toast } = useStore();
  const [list, setList] = useState<C[] | null>(null);
  const [quote, setQuote] = useState<Record<string, { amount: string; note: string }>>({});
  const load = useCallback(() => fetch("/api/catering").then((r) => r.json()).then(setList).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  if (!list) return <p className="muted">Loading…</p>;

  async function send(c: C) {
    const q = quote[c.code] ?? { amount: "", note: "" };
    const r = await fetch(`/api/catering/${c.code}`, json("PATCH", { amount: Number(q.amount), note: q.note }));
    if (!r.ok) return toast((await r.json()).error);
    toast(`Quote sent to ${c.email} ✿`);
    load();
  }
  async function move(c: C, status: string, msg: string) {
    const r = await fetch(`/api/catering/${c.code}`, json("PATCH", { status }));
    if (!r.ok) return toast((await r.json()).error);
    toast(msg);
    load();
  }
  const q = (code: string) => quote[code] ?? { amount: "", note: "" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <p className="small muted">Guests ask for catering at <a href="/catering" target="_blank">/catering</a>. Send a quote here; they accept and pay online or on the day. Paid catering shows up in P&amp;L.</p>
      {!list.length && <p className="muted">No catering requests yet.</p>}
      {list.map((c) => (
        <section key={c.code} className="card" style={{ padding: "1rem 1.2rem", opacity: c.status === "declined" || c.status === "done" ? 0.6 : 1 }}>
          <div className="sum-row" style={{ alignItems: "baseline", flexWrap: "wrap", gap: "0.4rem" }}>
            <h3 style={{ fontSize: "1.15rem" }}>{c.guests} guests · {new Date(c.event_date + "T12:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} {c.event_time}</h3>
            <span className="status-tag">{LABEL[c.status] ?? c.status}</span>
          </div>
          <p className="small">{c.name} · <a href={`mailto:${c.email}`}>{c.email}</a> · <a href={`tel:${c.phone}`}>{c.phone}</a> · {c.kind} · {c.method === "delivery" ? `deliver to ${c.address}` : "they'll collect"}</p>
          <p className="small" style={{ whiteSpace: "pre-line", background: "var(--surface-2)", padding: "0.6rem 0.8rem", borderRadius: 10 }}>{c.details}</p>
          {c.amount !== null && <p className="small">Quote: <b>{rupees(c.amount)}</b>{c.quote_note ? <span className="muted"> · {c.quote_note}</span> : ""}</p>}
          {(c.status === "requested" || c.status === "quoted") && (
            <div className="pnl-add" style={{ gridTemplateColumns: "1fr 2.5fr auto auto" }}>
              <input className="input" inputMode="numeric" placeholder="₹ total" aria-label="Quote total" value={q(c.code).amount} onChange={(e) => setQuote({ ...quote, [c.code]: { ...q(c.code), amount: e.target.value.replace(/\D/g, "") } })} />
              <input className="input" placeholder="What's included (shown to the guest)" aria-label="What's included" maxLength={1500} value={q(c.code).note} onChange={(e) => setQuote({ ...quote, [c.code]: { ...q(c.code), note: e.target.value } })} />
              <button className="btn btn-pink btn-sm" disabled={!Number(q(c.code).amount)} onClick={() => send(c)}>{c.status === "quoted" ? "Send new quote" : "Send quote"}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => move(c, "declined", "Declined")}>Decline</button>
            </div>
          )}
          {c.status === "accepted" && <button className="btn btn-ghost btn-sm" onClick={() => move(c, "paid", "Marked paid ✓")}>Mark paid</button>}
          {(c.status === "accepted" || c.status === "paid") && <button className="btn btn-ghost btn-sm" style={{ marginLeft: "0.4rem" }} onClick={() => move(c, "done", "Done ✿")}>Mark done</button>}
          <a className="link-btn small" style={{ marginLeft: "0.6rem" }} href={`/catering/${c.code}`} target="_blank">Guest&apos;s page ↗</a>
        </section>
      ))}
    </div>
  );
}
