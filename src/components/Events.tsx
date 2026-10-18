"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePay } from "./Payment";
import { rupees } from "@/lib/pricing";
import type { CafeEvent } from "@/lib/cafe";
import { photo } from "@/lib/menu";
import { useStore } from "./Store";
import Reveal from "./Reveal";

type Ev = CafeEvent & { spotsLeft: number };

export default function Events() {
  const { toast, t } = useStore();
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "" });
  const [error, setError] = useState("");
  const [going, setGoing] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const pay = usePay();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/events").then((r) => r.json()).then(setEvents).catch(() => setEvents([]));
    try { setGoing(JSON.parse(localStorage.getItem("mm-rsvps") || "[]")); } catch {}
  }, []);

  async function buy(e: React.FormEvent, ev: Ev) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const r = await fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: ev.id, qty, ...form }) });
    const d = await r.json();
    if (!r.ok) { setBusy(false); return setError(d.error); }
    const ok = await pay("ticket", d.code, { name: form.name, email: form.email });
    setBusy(false);
    if (!ok) return setError("Payment didn't finish. Your spot is held for 15 minutes, so try again.");
    try { localStorage.setItem("mm-tickets", JSON.stringify([d.code, ...JSON.parse(localStorage.getItem("mm-tickets") || "[]")].slice(0, 20))); } catch {}
    toast("You're in! Here's your ticket 🎟");
    router.push(`/ticket/${d.code}`);
  }

  async function rsvp(e: React.FormEvent, ev: Ev) {
    if (ev.price) return buy(e, ev);
    e.preventDefault();
    setError("");
    const r = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: ev.id, ...form }) });
    const d = await r.json();
    if (!r.ok) return setError(d.error);
    setEvents((es) => es?.map((x) => (x.id === ev.id ? { ...x, spotsLeft: d.spotsLeft } : x)) ?? null);
    const g = [...going, ev.id];
    setGoing(g);
    try { localStorage.setItem("mm-rsvps", JSON.stringify(g)); } catch {}
    setOpenId(null);
    toast(`You're on the list for ${ev.title} ✿`);
  }

  return (
    <Reveal id="events" className="section">
      <div className="center">
        <p className="eyebrow">{t("events.eyebrow")}</p>
        <h2>{t("events.title1")} <em>{t("events.title2")}</em></h2>
        <p className="lead">Workshops, open mics and slow Sundays. Most are free to join; classes need a ticket.</p>
      </div>
      <div className="events">
        {events === null && <p className="muted center">Loading events…</p>}
        {events?.length === 0 && <p className="muted center">New events coming soon ☾</p>}
        {events?.map((ev) => {
          const d = new Date(ev.date + "T" + ev.time);
          const isGoing = going.includes(ev.id);
          return (
            <article key={ev.id} className="event card">
              <div className="event-photo">
                <Image src={photo(ev.img, 600)} alt="" fill sizes="(max-width: 600px) 90vw, 320px" />
                <div className="date-badge">
                  <strong>{d.getDate()}</strong>
                  <span>{d.toLocaleDateString("en-IN", { month: "short" })}</span>
                </div>
              </div>
              <div className="event-body">
                <h3>{ev.title}</h3>
                <span className="small muted">
                  {d.toLocaleDateString("en-IN", { weekday: "long" })} · {d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                </span>
                <p>{ev.desc}</p>
                <span className="small"><b>{ev.price ? `${rupees(ev.price)} per ticket` : "Free · just RSVP"}</b></span>
                <span className={`spots ${ev.spotsLeft <= 3 ? "low" : ""}`}>
                  {ev.spotsLeft === 0 ? "Fully booked" : `${ev.spotsLeft} of ${ev.capacity} spots left`}
                </span>
                {isGoing ? (
                  <button className="btn btn-ghost btn-sm" disabled>✓ You&apos;re going</button>
                ) : openId === ev.id ? (
                  <form className="rsvp-form" onSubmit={(e) => rsvp(e, ev)}>
                    <input className="input" required placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    <input className="input" required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    {ev.price > 0 && (
                      <label className="row small" style={{ alignItems: "center", gap: "0.5rem" }}>
                        Tickets
                        <select className="input" style={{ width: "auto" }} value={qty} onChange={(e) => setQty(Number(e.target.value))}>
                          {[1, 2, 3, 4].filter((n) => n <= ev.spotsLeft).map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <span className="muted">= {rupees(ev.price * qty)}</span>
                      </label>
                    )}
                    {error && <p className="error small">{error}</p>}
                    <div className="row">
                      <button className="btn btn-pink btn-sm" style={{ flex: 1 }} disabled={busy}>{ev.price ? (busy ? "Opening payment…" : `Pay ${rupees(ev.price * qty)}`) : "Save my spot"}</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpenId(null)}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <button className="btn btn-sm" disabled={ev.spotsLeft === 0} onClick={() => { setOpenId(ev.id); setError(""); setQty(1); }}>{ev.price ? "Get tickets" : "RSVP"}</button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </Reveal>
  );
}
