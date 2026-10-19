"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";

type Item = { id: string; kind: "game" | "book"; title: string; detail: string; minutes: number | null; note: string | null; out: number };

/** Owner, Bookings tab: the games & books shelf */
export default function ShelfCard() {
  const { toast } = useStore();
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ kind: "game" as "game" | "book", title: "", detail: "", minutes: "" });
  const load = () => fetch("/api/shelf").then((r) => r.json()).then((d) => setItems(d.items ?? [])).catch(() => {});
  useEffect(() => { load(); }, []);
  async function save(body: Record<string, unknown>, msg: string) {
    const r = await fetch("/api/shelf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return toast(d.error ?? "That didn't save.");
    toast(msg); load();
  }
  async function remove(i: Item) {
    await fetch(`/api/shelf?id=${encodeURIComponent(i.id)}`, { method: "DELETE" });
    toast(`${i.title} removed`); load();
  }
  const games = items.filter((i) => i.kind === "game").length;
  return (
    <section className="card" style={{ padding: "1rem", marginTop: "1rem" }}>
      <div className="sum-row" style={{ alignItems: "center" }}>
        <h3 style={{ fontSize: "1.15rem" }}>🎲 Games & books shelf <span className="muted small">· {games} games, {items.length - games} books</span></h3>
        <span className="row" style={{ gap: "0.4rem" }}>
          <a className="btn btn-ghost btn-sm" href="/shelf" target="_blank" rel="noreferrer">See it ↗</a>
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>{open ? "Close" : "Manage"}</button>
        </span>
      </div>
      <p className="small muted">Guests can keep a game for their table when they book. A game reserved within 2 hours of another booking shows as taken.</p>
      {open && (
        <>
          <form className="row" style={{ gap: "0.6rem", alignItems: "flex-end", flexWrap: "wrap" }} onSubmit={(e) => { e.preventDefault(); save({ ...f, minutes: Number(f.minutes) || null }, `${f.title} added ✿`); setF({ ...f, title: "", detail: "", minutes: "" }); }}>
            <label className="field small" style={{ maxWidth: 120 }}>Kind<select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as "game" | "book" })}><option value="game">Game</option><option value="book">Book</option></select></label>
            <label className="field small">Title<input className="input" required maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
            <label className="field small">{f.kind === "game" ? "Players (e.g. 2–4 players)" : "Author"}<input className="input" maxLength={80} value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} /></label>
            {f.kind === "game" && <label className="field small" style={{ maxWidth: 110 }}>Minutes<input className="input" inputMode="numeric" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value.replace(/\D/g, "") })} /></label>}
            <button className="btn btn-pink btn-sm">Add</button>
          </form>
          <ul className="check-list" style={{ marginTop: "0.8rem" }}>
            {items.map((i) => (
              <li key={i.id}>
                <span style={{ flex: 1 }}>{i.kind === "game" ? "🎲" : "📚"} <b>{i.title}</b> <span className="muted small">{i.detail}</span>{i.out ? <span className="branch-tag">off the shelf</span> : null}</span>
                <button className="chip" onClick={() => save({ ...i, out: !i.out }, i.out ? `${i.title} is back` : `${i.title} marked off the shelf`)}>{i.out ? "Back on shelf" : "Off shelf"}</button>
                <button className="chip" onClick={() => remove(i)}>Remove</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
