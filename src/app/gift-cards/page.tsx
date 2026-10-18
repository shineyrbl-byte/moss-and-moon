"use client";
import { useState } from "react";
import { rupees } from "@/lib/pricing";
import { usePay } from "@/components/Payment";
import { useStore } from "@/components/Store";

const DESIGNS = [
  { id: "blush", label: "Blush", emoji: "🌸" },
  { id: "mocha", label: "Mocha", emoji: "☕" },
  { id: "matcha", label: "Matcha", emoji: "🍵" },
];
const AMOUNTS = [500, 1000, 2000];

export default function GiftCards() {
  const pay = usePay();
  const { toast } = useStore();
  const [form, setForm] = useState({ amount: 1000, custom: "", fromName: "", toName: "", toEmail: "", message: "", design: "blush" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ code: string; toName: string; toEmail: string; amount: number } | null>(null);
  const [check, setCheck] = useState("");
  const [balance, setBalance] = useState<string>("");

  const amount = form.custom ? Math.floor(Number(form.custom)) : form.amount;
  const design = DESIGNS.find((d) => d.id === form.design)!;

  async function buy(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/giftcards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, amount }) });
      const d = await r.json();
      if (!r.ok) return setError(d.error);
      const ok = await pay("giftcard", d.code, { name: form.fromName });
      if (!ok) return setError("Payment was cancelled — your card hasn't been sent.");
      setSent({ code: d.code, toName: form.toName, toEmail: form.toEmail, amount });
      toast("Gift card sent! 🎁");
    } finally {
      setBusy(false);
    }
  }

  async function checkBalance(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch(`/api/giftcards/${encodeURIComponent(check.trim())}`);
    const d = await r.json();
    setBalance(r.ok ? `${rupees(d.balance)} left of ${rupees(d.amount)} ✿` : d.error);
  }

  return (
    <div className="page" style={{ maxWidth: "64rem" }}>
      <p className="eyebrow">gift cards</p>
      <h1 style={{ fontSize: "clamp(2.4rem, 6vw, 4rem)" }}>Send a little <em>café love</em></h1>
      <p className="lead">Delivered by email in seconds. They can spend it on anything, and leftover balance stays on the card.</p>

      <div className="gift-layout">
        <div>
          <div className={`gift-card ${form.design}`}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="logo" style={{ fontSize: "1.5rem" }}>Moss <span>&</span> Moon</span>
              <span style={{ fontSize: "2rem" }}>{design.emoji}</span>
            </div>
            <div>
              <p className="small" style={{ opacity: 0.8 }}>for {form.toName || "someone lovely"}</p>
              <p className="gift-amount">{amount >= 1 ? rupees(amount) : "₹—"}</p>
              {form.message && <p className="serif" style={{ fontStyle: "italic", fontSize: "1.1rem" }}>“{form.message}”</p>}
              <p className="small" style={{ opacity: 0.8, marginTop: "0.4rem" }}>from {form.fromName || "you"}</p>
            </div>
          </div>
          <form className="card" style={{ padding: "1.2rem", marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.6rem" }} onSubmit={checkBalance}>
            <strong>Got a card? Check its balance</strong>
            <div className="row">
              <input className="input" style={{ flex: 1 }} placeholder="GIFT-XXXXXXXX" value={check} onChange={(e) => setCheck(e.target.value)} />
              <button className="btn btn-ghost btn-sm" disabled={!check.trim()}>Check</button>
            </div>
            {balance && <p className="small">{balance}</p>}
          </form>
        </div>

        {sent ? (
          <div className="card confirm" style={{ padding: "2rem" }}>
            <span className="big">🎁</span>
            <h2 className="h3">On its way to {sent.toName}!</h2>
            <p className="muted">We emailed a {rupees(sent.amount)} card to {sent.toEmail}. Here&apos;s the code too, just in case:</p>
            <span className="code">{sent.code}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => { setSent(null); setForm({ ...form, toName: "", toEmail: "", message: "" }); }}>Send another</button>
          </div>
        ) : (
          <form className="card booking" onSubmit={buy}>
            <h2 className="h3">Make it yours</h2>
            <div className="field">Design
              <div className="chips" style={{ justifyContent: "flex-start" }}>
                {DESIGNS.map((d) => (
                  <button type="button" key={d.id} className={`chip ${form.design === d.id ? "on" : ""}`} onClick={() => setForm({ ...form, design: d.id })}>{d.emoji} {d.label}</button>
                ))}
              </div>
            </div>
            <div className="field">Amount
              <div className="chips" style={{ justifyContent: "flex-start" }}>
                {AMOUNTS.map((a) => (
                  <button type="button" key={a} className={`chip ${!form.custom && form.amount === a ? "on" : ""}`} onClick={() => setForm({ ...form, amount: a, custom: "" })}>{rupees(a)}</button>
                ))}
                <input className="input" style={{ width: "8rem", padding: "0.4rem 0.8rem" }} inputMode="numeric" placeholder="Other ₹" value={form.custom} onChange={(e) => setForm({ ...form, custom: e.target.value.replace(/\D/g, "") })} />
              </div>
            </div>
            <div className="row">
              <label className="field">From<input className="input" required maxLength={40} value={form.fromName} onChange={(e) => setForm({ ...form, fromName: e.target.value })} /></label>
              <label className="field">To<input className="input" required maxLength={40} value={form.toName} onChange={(e) => setForm({ ...form, toName: e.target.value })} /></label>
            </div>
            <label className="field">Their email<input className="input" type="email" required value={form.toEmail} onChange={(e) => setForm({ ...form, toEmail: e.target.value })} /></label>
            <label className="field">A little message<textarea className="input" rows={2} maxLength={200} placeholder="Happy birthday! Coffee's on me ☕" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>
            {error && <p className="error">{error}</p>}
            <button className="btn btn-pink full" disabled={busy || !(amount >= 200 && amount <= 10000)}>
              {busy ? "One moment…" : amount >= 200 && amount <= 10000 ? `Pay ${rupees(amount)} & send` : "Choose ₹200 – ₹10,000"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
