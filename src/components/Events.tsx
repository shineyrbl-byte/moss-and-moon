"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { CafeEvent } from "@/lib/cafe";
import { photo } from "@/lib/menu";
import { useStore } from "./Store";
import Reveal from "./Reveal";

type Ev = CafeEvent & { spotsLeft: number };

export default function Events() {
  const { toast } = useStore();
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "" });
  const [error, setError] = useState("");
  const [going, setGoing] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/events").then((r) => r.json()).then(setEvents).catch(() => setEvents([]));
    try { setGoing(JSON.parse(localStorage.getItem("mm-rsvps") || "[]")); } catch {}
  }, []);

  async function rsvp(e: React.FormEvent, ev: Ev) {
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
        <p className="eyebrow">what&apos;s on</p>
        <h2>Little <em>gatherings</em></h2>
        <p className="lead">Workshops, open mics and slow Sundays. Save a spot — it&apos;s free.</p>
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
                <span className={`spots ${ev.spotsLeft <= 3 ? "low" : ""}`}>
                  {ev.spotsLeft === 0 ? "Fully booked" : `${ev.spotsLeft} of ${ev.capacity} spots left`}
                </span>
                {isGoing ? (
                  <button className="btn btn-ghost btn-sm" disabled>✓ You&apos;re going</button>
                ) : openId === ev.id ? (
                  <form className="rsvp-form" onSubmit={(e) => rsvp(e, ev)}>
                    <input className="input" required placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    <input className="input" required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    {error && <p className="error small">{error}</p>}
                    <div className="row">
                      <button className="btn btn-pink btn-sm" style={{ flex: 1 }}>Save my spot</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpenId(null)}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <button className="btn btn-sm" disabled={ev.spotsLeft === 0} onClick={() => { setOpenId(ev.id); setError(""); }}>RSVP</button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </Reveal>
  );
}
