"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { rupees } from "@/lib/pricing";
import { usePay } from "@/components/Payment";
import { useStore } from "@/components/Store";

type C = { code: string; name: string; eventDate: string; eventTime: string; guests: number; kind: string; method: string; address: string | null; details: string; status: string; amount: number | null; quoteNote: string | null; payChoice: string | null; paid: boolean };
const STEPS = [
  { id: "requested", label: "Request sent", icon: "📝" },
  { id: "quoted", label: "Quote ready", icon: "💌" },
  { id: "accepted", label: "Confirmed", icon: "✓" },
  { id: "done", label: "Enjoyed", icon: "🧺" },
];

export default function CateringStatus() {
  const { code } = useParams<{ code: string }>();
  const pay = usePay();
  const { toast } = useStore();
  const [c, setC] = useState<C | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => fetch(`/api/catering/${code}`).then(async (r) => { const d = await r.json(); if (!r.ok) return setError(d.error); setC(d); }).catch(() => setError("Couldn't load it.")), [code]);
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="page center"><h2>Hmm, <em>not found</em></h2><p className="lead">{error}</p><Link className="btn" href="/catering">Catering</Link></div>;
  if (!c) return <div className="page center"><p className="muted">Loading…</p></div>;
  const when = new Date(`${c.eventDate}T12:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const stepAt = c.status === "declined" ? -1 : c.status === "paid" ? 2 : STEPS.findIndex((s) => s.id === c.status);

  async function payNow() {
    setBusy(true);
    const ok = await pay("catering", c!.code, { name: c!.name });
    setBusy(false);
    if (ok) { toast("Paid. Thank you! ✿"); load(); }
  }
  async function payLater() {
    setBusy(true);
    const r = await fetch(`/api/catering/${c!.code}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "accept" }) });
    setBusy(false);
    if (!r.ok) return toast((await r.json()).error);
    toast("Confirmed! See you then 🌸");
    load();
  }

  return (
    <div className="page narrow">
      <p className="eyebrow">catering {c.code}</p>
      <h1 className="h2">{c.guests} guests, <em>{when}</em></h1>
      <p className="lead">{c.eventTime} · {c.method === "delivery" ? `delivered to ${c.address}` : "collected from the café"}</p>
      {c.status === "declined" ? (
        <p className="reward-banner">Sorry, we can&apos;t take this one on. Please call us and we&apos;ll try to help another way.</p>
      ) : (
        <ol className="steps" aria-label="Progress" style={{ listStyle: "none", padding: 0 }}>
          <div className="bar" style={{ width: `${(Math.max(0, stepAt) / (STEPS.length - 1)) * 75}%` }} />
          {STEPS.map((s, i) => (
            <li key={s.id} className={`step ${i <= stepAt ? "done" : ""}`} aria-current={i === stepAt ? "step" : undefined}>
              <span className="circle" aria-hidden="true">{s.icon}</span>{s.label}
            </li>
          ))}
        </ol>
      )}
      <div className="card" style={{ padding: "1.3rem", marginTop: "1rem" }}>
        <h3 style={{ fontSize: "1.1rem" }}>What you asked for</h3>
        <p style={{ whiteSpace: "pre-line" }}>{c.details}</p>
        {c.amount !== null && (
          <>
            <hr style={{ border: 0, borderTop: "1px dashed var(--line)", margin: "1rem 0" }} />
            <h3 style={{ fontSize: "1.1rem" }}>Our quote</h3>
            <p style={{ fontSize: "2rem", fontFamily: "var(--serif, Georgia, serif)", margin: "0.2rem 0" }}>{rupees(c.amount)}</p>
            {c.quoteNote && <p style={{ whiteSpace: "pre-line" }}>{c.quoteNote}</p>}
          </>
        )}
        {c.status === "requested" && <p className="muted">We&apos;re putting your quote together. It&apos;ll arrive by email within a day.</p>}
        {c.status === "quoted" && (
          <div className="row" style={{ marginTop: "0.8rem" }}>
            <button className="btn btn-pink" disabled={busy} onClick={payNow}>Accept &amp; pay {rupees(c.amount ?? 0)}</button>
            <button className="btn btn-ghost" disabled={busy} onClick={payLater}>Accept, pay on the day</button>
          </div>
        )}
        {c.status === "accepted" && (
          <>
            <p className="success">✓ Confirmed. {rupees(c.amount ?? 0)} to pay on the day.</p>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={payNow}>Pay online now instead</button>
          </>
        )}
        {(c.status === "paid" || (c.status === "done" && c.paid)) && <p className="success">✓ {rupees(c.amount ?? 0)} paid. Thank you!</p>}
      </div>
      <p className="small muted" style={{ marginTop: "1rem" }}>Need to change something? Reply to any of our emails or call the café.</p>
    </div>
  );
}
