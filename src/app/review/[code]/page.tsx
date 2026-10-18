"use client";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { QuoteLine } from "@/lib/pricing";

function ReviewVisit() {
  const { code } = useParams<{ code: string }>();
  const fromEmail = Number(useSearchParams().get("stars"));
  const [order, setOrder] = useState<{ name: string; lines: QuoteLine[] } | null>(null);
  const [rating, setRating] = useState(fromEmail >= 1 && fromEmail <= 5 ? fromEmail : 0);
  const [form, setForm] = useState({ name: "", text: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/orders/${code}`).then((r) => r.json()).then((d) => {
      if (d.code) {
        setOrder(d);
        setForm((f) => ({ ...f, name: f.name || d.name }));
      } else setError("We couldn't find that visit.");
    }).catch(() => {});
  }, [code]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, rating, orderCode: code }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setError(d.error);
    setDone(true);
  }

  if (done)
    return (
      <div className="page narrow center">
        <span style={{ fontSize: "3rem" }}>{rating >= 4 ? "🌸" : "🤍"}</span>
        <h1 className="h2">Thank you, <em>{form.name}</em></h1>
        <p className="lead">{rating >= 4 ? "That made our day. See you again soon ☕" : "Sorry it wasn't perfect. We've passed this to the team and we'll do better."}</p>
        <Link href="/#menu" className="btn" style={{ marginTop: "1.5rem" }}>Back to the menu</Link>
      </div>
    );

  return (
    <div className="page narrow">
      <p className="eyebrow">order {String(code).toUpperCase()}</p>
      <h1 className="h2">How was <em>your visit?</em></h1>
      {order && <p className="lead">{order.lines.map((l) => `${l.qty} × ${l.name}`).join(", ")}</p>}
      <form className="card booking" onSubmit={send} style={{ marginTop: "1.2rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        <div className="star-pick" role="radiogroup" aria-label="Your rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} className={n <= rating ? "on" : ""} onClick={() => setRating(n)}>★</button>
          ))}
        </div>
        <label className="field">Your name<input className="input" required maxLength={40} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="field">{rating && rating <= 3 ? "What could we do better?" : "What did you love?"}
          <textarea className="input" rows={3} required minLength={5} maxLength={400} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
        </label>
        {error && <p className="error small">{error}</p>}
        <button className="btn btn-pink" disabled={busy || !rating}>{busy ? "Sending…" : "Send"}</button>
      </form>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="page center muted">Loading…</div>}><ReviewVisit /></Suspense>;
}
