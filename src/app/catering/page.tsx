"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toDateStr } from "@/lib/cafe";

const KINDS = [
  { id: "office", label: "Office / team" },
  { id: "meeting", label: "Meeting" },
  { id: "birthday", label: "Birthday" },
  { id: "party", label: "Party" },
  { id: "other", label: "Something else" },
];
const IDEAS = ["Coffee & tea for everyone", "Croissants and bakes", "Sandwiches & savoury bites", "Cookie & brownie box", "Iced drinks", "Vegan / gluten-free options"];

export default function CateringPage() {
  const [min, setMin] = useState("");
  const [f, setF] = useState({ name: "", email: "", phone: "", date: "", time: "11:00", guests: 20, kind: "office", method: "delivery", address: "", details: "" });
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => {
    const d = toDateStr(new Date(Date.now() + 2 * 86_400_000));
    setMin(d);
    setF((v) => ({ ...v, date: d }));
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const details = [picked.length ? `Interested in: ${picked.join(", ")}.` : "", f.details].filter(Boolean).join("\n");
    const r = await fetch("/api/catering", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, details }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setError(d.error);
    setDone(d.code);
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: k === "guests" ? Number(e.target.value) : e.target.value });

  return (
    <div className="page narrow">
      <p className="eyebrow">for 10 or more</p>
      <h1 className="h2">Catering, <em>made with love</em></h1>
      <p className="lead">Coffee, bakes and bites for your office, meeting or party. Tell us what you&apos;re planning and we&apos;ll send a quote within a day. Pay online or on the day.</p>
      {done ? (
        <div className="card confirm" style={{ padding: "1.6rem", marginTop: "1.4rem" }}>
          <span className="big">🧺</span>
          <h3>Request sent!</h3>
          <p className="muted">We&apos;ve emailed {f.email} a copy. Your quote will arrive there, and on this page:</p>
          <Link className="btn btn-pink" href={`/catering/${done}`}>Track request {done}</Link>
        </div>
      ) : (
        <form className="card" onSubmit={send} style={{ padding: "1.4rem", marginTop: "1.4rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="row">
            <label className="field">Your name<input className="input" required maxLength={60} value={f.name} onChange={set("name")} /></label>
            <label className="field">Phone<input className="input" required inputMode="numeric" placeholder="10 digits" value={f.phone} onChange={set("phone")} /></label>
          </div>
          <label className="field">Email<input className="input" type="email" required value={f.email} onChange={set("email")} /></label>
          <div className="row">
            <label className="field">Date<input className="input" type="date" required min={min} value={f.date} onChange={set("date")} /></label>
            <label className="field">Time<input className="input" type="time" required value={f.time} onChange={set("time")} /></label>
            <label className="field">Guests<input className="input" type="number" min={10} max={500} required value={f.guests} onChange={set("guests")} /></label>
          </div>
          <div className="field">
            What&apos;s the occasion?
            <div className="chips" style={{ justifyContent: "flex-start" }} role="radiogroup" aria-label="Occasion">
              {KINDS.map((k) => <button type="button" role="radio" aria-checked={f.kind === k.id} key={k.id} className={`chip ${f.kind === k.id ? "on" : ""}`} onClick={() => setF({ ...f, kind: k.id })}>{k.label}</button>)}
            </div>
          </div>
          <div className="field">
            What would you like? <span className="muted small">· pick any</span>
            <div className="chips" style={{ justifyContent: "flex-start" }}>
              {IDEAS.map((i) => <button type="button" aria-pressed={picked.includes(i)} key={i} className={`chip ${picked.includes(i) ? "on" : ""}`} onClick={() => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))}>{i}</button>)}
            </div>
          </div>
          <label className="field">Anything else? <span className="muted small">· budget, allergies, set-up</span><textarea className="input" rows={3} maxLength={1200} value={f.details} onChange={set("details")} placeholder="e.g. 25 people, two are vegan, around ₹300 a head" /></label>
          <div className="chips" style={{ justifyContent: "flex-start" }} role="radiogroup" aria-label="Pickup or delivery">
            {["delivery", "pickup"].map((m) => <button type="button" role="radio" aria-checked={f.method === m} key={m} className={`chip ${f.method === m ? "on" : ""}`} onClick={() => setF({ ...f, method: m })}>{m === "delivery" ? "Deliver it" : "We'll collect"}</button>)}
          </div>
          {f.method === "delivery" && <label className="field">Delivery address<textarea className="input" rows={2} required maxLength={200} value={f.address} onChange={set("address")} /></label>}
          {error && <p className="error">{error}</p>}
          <button className="btn btn-pink full" disabled={busy || (!picked.length && f.details.trim().length < 5)}>{busy ? "Sending…" : "Ask for a quote"}</button>
          <p className="tiny muted">We need at least 2 days&apos; notice. No payment now.</p>
        </form>
      )}
    </div>
  );
}
