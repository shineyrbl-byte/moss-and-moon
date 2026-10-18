"use client";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { photo } from "@/lib/menu";
import { rupees } from "@/lib/pricing";
import type { CafeEvent } from "@/lib/cafe";
import { useStore } from "../Store";

type Ev = CafeEvent & { spotsLeft: number };
const blank = { id: "", title: "", date: "", time: "18:00", desc: "", img: "", capacity: 20, price: 0, repeat: "none", times: 4 };
const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** Owner: add, edit and delete events (free RSVP when the price is ₹0) */
export default function EventManager({ onChange }: { onChange?: () => void }) {
  const { toast } = useStore();
  const [list, setList] = useState<Ev[] | null>(null);
  const [f, setF] = useState<typeof blank | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => fetch("/api/events?all=1").then((r) => r.json()).then(setList).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f) return;
    const r = await fetch("/api/events", json("PUT", { ...f, id: f.id || undefined }));
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    toast(f.id ? "Event updated ✓" : d.created ? `${d.created} events added ✓` : "Event added ✓ It's on the site now.");
    setF(null);
    load();
    onChange?.();
  }
  async function removeSeries(id: string) {
    const r = await fetch("/api/events", json("DELETE", { id, series: true }));
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    toast(`Removed ${d.removed} date${d.removed === 1 ? "" : "s"}${d.kept ? `; kept ${d.kept} with tickets sold` : ""}`);
    load();
    onChange?.();
  }
  async function remove(id: string) {
    const r = await fetch("/api/events", json("DELETE", { id }));
    const d = await r.json();
    toast(r.ok ? "Deleted" : d.error);
    if (r.ok) { setF(null); load(); onChange?.(); }
  }
  async function upload(file: File) {
    if (!f) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return toast(d.error);
    setF({ ...f, img: d.url });
  }

  const today = new Date().toISOString().slice(0, 10);
  return (
    <section className="card" style={{ padding: "1.1rem 1.2rem", display: "flex", flexDirection: "column", gap: "0.8rem" }}>
      <div className="sum-row" style={{ alignItems: "center" }}>
        <h3 style={{ fontSize: "1.3rem" }}>🎤 Events</h3>
        <button className="btn btn-pink btn-sm" onClick={() => setF(f ? null : { ...blank })}>{f && !f.id ? "Close" : "+ New event"}</button>
      </div>
      {f && (
        <form className="event-form" onSubmit={save}>
          <label className="field">Name<input className="input" required maxLength={60} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Latte Art for Beginners" /></label>
          <div className="row">
            <label className="field">Date<input className="input" type="date" required min={f.id ? undefined : today} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
            <label className="field">Starts<input className="input" type="time" required value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></label>
            {!f.id && (
              <label className="field">Repeats
                <span className="row" style={{ gap: "0.4rem" }}>
                  <select className="input" value={f.repeat} onChange={(e) => setF({ ...f, repeat: e.target.value })}>
                    <option value="none">Just once</option><option value="weekly">Every week</option><option value="fortnightly">Every 2 weeks</option><option value="monthly">Every month</option>
                  </select>
                  {f.repeat !== "none" && <><input className="input" type="number" min={2} max={26} style={{ width: "4.5rem" }} value={f.times} onChange={(e) => setF({ ...f, times: Number(e.target.value) })} aria-label="How many times" /><span className="small muted">times</span></>}
                </span>
              </label>
            )}
            <label className="field">Spots<input className="input" type="number" min={1} max={500} required value={f.capacity} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })} /></label>
            <label className="field">Ticket price (₹, 0 = free RSVP)<input className="input" type="number" min={0} max={20000} value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} /></label>
          </div>
          <label className="field">Description<textarea className="input" rows={2} maxLength={300} value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} placeholder="What happens, what's included, what to bring" /></label>
          <div className="row" style={{ alignItems: "center" }}>
            {f.img && <div className="event-thumb"><Image src={photo(f.img, 300)} alt="" fill sizes="90px" /></div>}
            <label className="field" style={{ flex: 1 }}>Photo: Unsplash link, or upload one
              <input className="input" value={f.img} onChange={(e) => setF({ ...f, img: e.target.value })} placeholder="https://images.unsplash.com/photo-…" />
            </label>
            <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>{busy ? "Uploading…" : "Upload"}<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="row">
              <button className="btn btn-pink btn-sm">{f.id ? "Save changes" : "Add event"}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setF(null)}>Cancel</button>
            </span>
            {f.id && <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(f.id)}>Delete</button>}
          </div>
        </form>
      )}
      <ul className="backup-list">
        {list?.map((e) => (
          <li key={e.id} className={e.date < today ? "muted" : ""}>
            <span><b>{e.title}</b> · {new Date(`${e.date}T${e.time}`).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{e.date < today ? " · past" : ""}</span>
            <span className="small">{e.price ? rupees(e.price) : "free"} · {e.capacity - e.spotsLeft}/{e.capacity}</span>
            <button className="link-btn" onClick={() => setF({ id: e.id, title: e.title, date: e.date, time: e.time, desc: e.desc, img: e.img, capacity: e.capacity, price: e.price, repeat: "none", times: 4 })}>Edit</button>
            {e.series && <button className="link-btn" onClick={() => removeSeries(e.id)} title="Remove this and every later date in the series">Remove series</button>}
          </li>
        ))}
        {list && !list.length && <li className="muted"><span>No events yet.</span><span /><span /></li>}
      </ul>
    </section>
  );
}
