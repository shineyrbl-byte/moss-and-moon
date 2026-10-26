"use client";
import "./page.css";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { usePay } from "@/components/Payment";
import { defaultOptions, rupees, unitPrice } from "@/lib/pricing";
import { itemName, photo } from "@/lib/menu";

const PICKS = ["cappuccino", "chai", "filter-kaapi", "cold-brew", "americano", "turmeric-latte"];

export default function PayItForward() {
  const { find, lang, toast } = useStore();
  const pay = usePay();
  const [counts, setCounts] = useState<{ waiting: number; given: number } | null>(null);
  const [pick, setPick] = useState("cappuccino");
  const [qty, setQty] = useState(1);
  const [f, setF] = useState({ fromName: "", fromEmail: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(0);
  const load = () => fetch("/api/pay-forward").then((r) => r.json()).then(setCounts).catch(() => {});
  useEffect(() => { load(); }, []);
  const drinks = PICKS.map((id) => find(id)).filter((m) => m && !m.soldOut).slice(0, 4);
  const item = drinks.find((m) => m!.id === pick) ?? drinks[0];

  async function buy(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    setBusy(true); setErr("");
    let made = 0;
    for (let i = 0; i < qty; i++) {
      const r = await fetch("/api/drink-gifts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: item.id, opts: defaultOptions(item), forward: true, ...f }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error); break; }
      if (!(await pay("drinkgift", d.code, { name: f.fromName || "A kind stranger", email: f.fromEmail }))) { setErr("Payment didn't finish. Try again?"); break; }
      made++;
    }
    setBusy(false);
    if (made) { setDone(made); toast("Thank you 💛 It's waiting for someone."); load(); }
  }

  return (
    <div className="page narrow">
      <p className="eyebrow">a small kindness</p>
      <h1 className="h2">Pay it <em>forward</em></h1>
      <p className="lead">Buy a coffee for someone you&apos;ll never meet. It waits at the counter, and anyone who needs one can ask. No questions, no proof needed.</p>
      <div className="forward-count card">
        <span className="forward-big">☕ {counts?.waiting ?? "…"}</span>
        <span>{counts?.waiting === 1 ? "coffee waiting" : "coffees waiting"} right now</span>
        {!!counts?.given && <span className="small muted">{counts.given} handed out so far 💛</span>}
      </div>
      {done ? (
        <div className="card" style={{ padding: "1.2rem", marginTop: "1rem", textAlign: "center" }}>
          <p className="lead" style={{ margin: 0 }}>💛 {done === 1 ? "Your coffee is" : `Your ${done} coffees are`} on the wall.</p>
          <p className="small muted">We&apos;ll hand {done === 1 ? "it" : "them"} to whoever needs one next.</p>
          <button className="btn btn-ghost btn-sm" onClick={() => setDone(0)}>Buy another</button>
        </div>
      ) : item && (
        <form className="card booking" onSubmit={buy} style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          <div className="forward-picks" role="radiogroup" aria-label="Which drink">
            {drinks.map((m) => (
              <button type="button" key={m!.id} role="radio" aria-checked={item.id === m!.id} className={`forward-pick ${item.id === m!.id ? "on" : ""}`} onClick={() => setPick(m!.id)}>
                <span className="forward-photo"><Image src={photo(m!.img, 200)} alt="" fill sizes="64px" style={{ objectFit: "cover" }} /></span>
                <span className="small">{itemName(m!, lang)}</span>
                <b className="small">{rupees(unitPrice(m!, defaultOptions(m!)))}</b>
              </button>
            ))}
          </div>
          <label className="row small" style={{ alignItems: "center", gap: "0.5rem" }}>How many
            <select className="input" style={{ width: "auto" }} value={qty} onChange={(e) => setQty(Number(e.target.value))}>{[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>
            <span className="muted">= {rupees(unitPrice(item, defaultOptions(item)) * qty)}</span>
          </label>
          <div className="row">
            <label className="field">Your name <span className="muted small">· optional</span><input className="input" maxLength={40} value={f.fromName} onChange={(e) => setF({ ...f, fromName: e.target.value })} placeholder="A kind stranger" /></label>
            <label className="field">Email for the receipt <span className="muted small">· optional</span><input className="input" type="email" value={f.fromEmail} onChange={(e) => setF({ ...f, fromEmail: e.target.value })} /></label>
          </div>
          <label className="field">A note on the cup <span className="muted small">· optional</span><input className="input" maxLength={140} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="Hope your day gets better ✿" /></label>
          {err && <p className="error small">{err}</p>}
          <button className="btn btn-pink" disabled={busy}>{busy ? "Opening payment…" : `💛 Pay ${rupees(unitPrice(item, defaultOptions(item)) * qty)}`}</button>
          <p className="tiny muted">Paid-forward coffees wait on the wall for up to a year. You can&apos;t claim your own: the team hands them out.</p>
        </form>
      )}
      <p className="small muted" style={{ marginTop: "1rem" }}>Need one? Just ask at the counter for a paid-forward coffee.</p>
    </div>
  );
}
