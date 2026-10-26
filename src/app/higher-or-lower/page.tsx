"use client";
import "./page.css";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { photo } from "@/lib/menu";
import { pairFrom, type HLItem } from "@/lib/higherLower";

type Board = { top: { name: string; score: number }[]; mine: number | null; best: number | null };
const BEST = "mm-higherlower-best";

export default function HigherOrLower() {
  const { toast } = useStore();
  const [items, setItems] = useState<HLItem[] | null>(null);
  const [pair, setPair] = useState<[HLItem, HLItem] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [out, setOut] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try { setBest(Number(localStorage.getItem(BEST)) || 0); setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    fetch("/api/menu").then((r) => r.json()).then((d: { items: (HLItem & { cat: string; pup?: boolean })[] }) => {
      const list = d.items.filter((m) => m.cat !== "shop" && !m.pup && m.price > 0).map(({ id, name, price, img }) => ({ id, name, price, img }));
      setItems(list); setPair(pairFrom(list, Math.random));
    }).catch(() => setItems([]));
    fetch(`/api/arcade?game=higherlower&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  function choose(id: string) {
    if (!pair || picked || !items) return;
    setPicked(id);
    const [a, b] = pair, right = (a.price > b.price ? a : b).id === id;
    if (right) {
      const s = streak + 1;
      setStreak(s);
      if (s > best) { setBest(s); try { localStorage.setItem(BEST, String(s)); } catch {} }
      setTimeout(() => { setPair(pairFrom(items, Math.random, [a.id, b.id])); setPicked(null); }, 1100);
    } else setTimeout(() => setOut(true), 900);
  }
  function again() { setStreak(0); setOut(false); setPicked(null); setSaved(false); if (items) setPair(pairFrom(items, Math.random)); }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/arcade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "higherlower", score: streak, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  if (!items) return <div className="page"><p className="muted">Reading the price list…</p></div>;
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">an arcade game</p>
      <h1 className="h2">Higher or <em>lower</em></h1>
      <p className="small muted">Two things from our menu. Tap the one that costs more. How long can you keep going?</p>
      <div className="memory-stats" style={{ justifyContent: "center", display: "flex" }}><span>Streak <b>{streak}</b></span><span>Best <b>{best}</b></span></div>
      {!pair ? <p className="small muted center">The menu&apos;s a bit short for this game today.</p> : !out ? (
        <div className="hl-pair">
          {pair.map((m, i) => {
            const win = picked && m.price === Math.max(pair[0].price, pair[1].price);
            return (
              <button key={m.id} className={`card hl-card ${picked ? (win ? "win" : "lose") : ""}`} onClick={() => choose(m.id)} disabled={!!picked} aria-label={`${m.name}${picked ? `, ₹${m.price}` : ""}`}>
                <span className="hl-img"><Image src={photo(m.img, 400)} alt="" fill sizes="(max-width: 600px) 45vw, 18rem" style={{ objectFit: "cover" }} /></span>
                <b>{m.name}</b>
                <span className="hl-price" aria-live="polite">{picked ? `₹${m.price}` : "₹ ?"}</span>
                {i === 0 && <span className="hl-or" aria-hidden="true">or</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <section className="card memory-done" aria-live="polite">
          <b>{streak ? `A streak of ${streak}! ${streak >= 10 ? "🏆" : "☕"}` : "Unlucky first go ☕"}</b>
          <p className="small" style={{ margin: 0 }}>{pair[0].name} is ₹{pair[0].price} and {pair[1].name} is ₹{pair[1].price}.</p>
          {streak > 0 && !saved && (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save score</button>
            </div>
          )}
          {saved && <p className="small" style={{ margin: 0 }}>Saved ✓</p>}
          <button className="btn btn-ghost btn-sm" onClick={again}>Play again</button>
        </section>
      )}
      {board && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">This week&apos;s longest streaks</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{t.score}</b></li>)}</ol> : <p className="small muted">No scores yet this week. Set the first one.</p>}
          <p className="tiny muted">The board starts fresh every Monday.</p>
        </section>
      )}
    </div>
  );
}
