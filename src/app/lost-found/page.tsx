"use client";
import "./page.css";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";

type Item = { id: number; what: string; where_found: string; found_on: string; img: string | null; claims: number };
const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

export default function LostFound() {
  const { toast } = useStore();
  const [items, setItems] = useState<Item[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [f, setF] = useState({ name: "", detail: "" });
  const [codes, setCodes] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/lost-found").then((r) => r.json()).then((d) => setItems(d.items)).catch(() => setItems([])); }, []);
  async function claim(e: React.FormEvent, id: number) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/lost-found", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...f }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast(d.error ?? "That didn't send. Try again?");
    setCodes({ ...codes, [id]: d.code }); setOpen(null); setF({ ...f, detail: "" });
  }
  return (
    <div className="page" style={{ maxWidth: "48rem" }}>
      <p className="eyebrow">left something behind?</p>
      <h1 className="h2">Lost <em>&amp;</em> found</h1>
      <p className="lead">Everything we&apos;ve found around the café in the last 30 days. See yours? Tell us something only the owner would know, and we&apos;ll keep it safe behind the counter.</p>
      {!items && <p className="muted">Checking the box under the counter…</p>}
      {items?.length === 0 && <p className="card muted center" style={{ padding: "1.4rem" }}>Nothing waiting right now 🧺 Everyone&apos;s things are home.</p>}
      <ul className="lost-grid">
        {items?.map((i) => (
          <li key={i.id} className="card lost-card">
            {i.img ? <img src={i.img} alt={i.what} className="lost-photo" loading="lazy" /> : <span className="lost-photo lost-blank" aria-hidden="true">🧺</span>}
            <b>{i.what}</b>
            <span className="small muted">Found {day(i.found_on)}{i.where_found ? ` · ${i.where_found}` : ""}</span>
            {codes[i.id] ? (
              <p className="lost-code" aria-live="polite">Show this at the counter: <b>{codes[i.id]}</b><span className="tiny muted">We&apos;ll check your description, then it&apos;s yours.</span></p>
            ) : open === i.id ? (
              <form onSubmit={(e) => claim(e, i.id)} style={{ display: "grid", gap: "0.4rem" }}>
                <label className="field small">Your name<input className="input" maxLength={40} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
                <label className="field small">How do we know it&apos;s yours?<textarea className="input" rows={2} maxLength={300} required value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} placeholder="A sticker on it, what's inside, the brand…" /></label>
                <span className="row" style={{ gap: "0.4rem" }}><button className="btn btn-pink btn-sm" disabled={busy}>{busy ? "Sending…" : "Send"}</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(null)}>Cancel</button></span>
              </form>
            ) : <button className="btn btn-ghost btn-sm" onClick={() => setOpen(i.id)}>That&apos;s mine</button>}
          </li>
        ))}
      </ul>
      <p className="small muted" style={{ marginTop: "1.2rem" }}>We list things for 30 days. Lost something longer ago, or something valuable like a phone or keys? Just ask at the counter.</p>
    </div>
  );
}
