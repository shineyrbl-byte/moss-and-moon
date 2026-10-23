"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";

/** Orders tab: hand out a paid-forward coffee to someone who asks */
export default function ForwardCard() {
  const { toast } = useStore();
  const [c, setC] = useState<{ waiting: number; given: number } | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => fetch("/api/pay-forward").then((r) => r.json()).then(setC).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!c || (!c.waiting && !c.given)) return null;
  async function give() {
    setBusy(true);
    const r = await fetch("/api/pay-forward", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return toast(d.error);
    toast(`☕ ${d.drink} is in the queue (${d.orderCode})`);
    setName("");
    load();
  }
  return (
    <section className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "1.1rem" }}>💛 Pay it forward <span className="branch-tag">{c.waiting} waiting</span></h3>
      <p className="small muted">Someone asks for a coffee: tap give, and it goes into the queue already paid. No questions asked. {c.given} given so far.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
        <input className="input" style={{ maxWidth: "14rem" }} placeholder="Name for the cup (optional)" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-pink btn-sm" disabled={!c.waiting || busy} onClick={give}>☕ Give one</button>
      </div>
    </section>
  );
}
