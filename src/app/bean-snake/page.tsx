"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { GRID, speed, start, tick, type Dir, type Snake } from "@/lib/snake";

type Board = { top: { name: string; score: number }[]; mine: number | null; best: number | null };
const BEST = "mm-snake-best";

export default function BeanSnake() {
  const { toast } = useStore();
  const [s, setS] = useState<Snake | null>(null);
  const [playing, setPlaying] = useState(false);
  const [best, setBest] = useState(0);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const want = useRef<Dir[]>([]);
  const touch = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    setS(start(Math.random));
    try { setBest(Number(localStorage.getItem(BEST)) || 0); setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    fetch(`/api/arcade?game=snake&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  // The game loop: one step at a time, quicker as the snake grows
  useEffect(() => {
    if (!playing || !s || s.over) return;
    const id = setTimeout(() => {
      const dir = want.current.shift() ?? s.dir;
      const next = tick(s, dir, Math.random);
      setS(next);
      if (next.over) {
        setPlaying(false);
        if (next.score > best) { setBest(next.score); try { localStorage.setItem(BEST, String(next.score)); } catch {} toast(`New best: ${next.score} beans! 🫘`); }
      }
    }, speed(s.score));
    return () => clearTimeout(id);
  }, [playing, s, best, toast]);
  // Pause if you switch away
  useEffect(() => { const h = () => document.hidden && setPlaying(false); document.addEventListener("visibilitychange", h); return () => document.removeEventListener("visibilitychange", h); }, []);
  function steer(d: Dir) {
    if (!s) return;
    if (s.over) return;
    if (!playing) setPlaying(true);
    if (want.current.length < 3) want.current.push(d);
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const d = ({ ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" } as Record<string, Dir>)[e.key];
      if (d) { e.preventDefault(); steer(d); }
      else if (e.key === " ") { e.preventDefault(); if (s?.over) again(); else setPlaying((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  function again() { want.current = []; setS(start(Math.random)); setSaved(false); setPlaying(true); }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/arcade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "snake", score: s?.score, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  if (!s) return <div className="page"><p className="muted">Waking the snake…</p></div>;
  const body = new Set(s.body);
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">an arcade game</p>
      <h1 className="h2">Bean <em>snake</em></h1>
      <p className="small muted">Eat the coffee beans to grow. Don&apos;t run into yourself. The edges wrap around, like a round café table. Swipe, use the arrow keys or the buttons. Space pauses.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>Beans <b>{s.score}</b></span><span>Best <b>{best}</b></span></div>
      <div className="snake-grid" style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)` }} role="img" aria-label={`Snake ${s.body.length} long, ${s.score} beans eaten`}
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchMove={(e) => {
          const t = touch.current;
          if (!t) return;
          const dx = e.touches[0].clientX - t.x, dy = e.touches[0].clientY - t.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
          steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
          touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }}
        onTouchEnd={() => (touch.current = null)}>
        {[...Array(GRID * GRID).keys()].map((p) => (
          <span key={p} className={`snake-cell ${p === s.body[0] ? "head" : body.has(p) ? "body" : ""}`}>{p === s.bean ? "🫘" : ""}</span>
        ))}
        {!playing && (
          <div className="snake-over">
            {s.over ? <><b>Bonk! {s.score} bean{s.score === 1 ? "" : "s"}</b><button className="btn btn-pink btn-sm" onClick={again}>Play again</button></>
              : <button className="btn btn-pink" onClick={() => setPlaying(true)}>{s.score || s.body.length > 3 ? "▶ Carry on" : "▶ Start"}</button>}
          </div>
        )}
      </div>
      <div className="mg-pad" role="group" aria-label="Steer">
        <button className="sd-key" onClick={() => steer("up")} aria-label="Up">↑</button>
        <button className="sd-key" onClick={() => steer("left")} aria-label="Left">←</button>
        <button className="sd-key" onClick={() => steer("down")} aria-label="Down">↓</button>
        <button className="sd-key" onClick={() => steer("right")} aria-label="Right">→</button>
      </div>
      {s.over && s.score > 0 && !saved && (
        <div className="row" style={{ justifyContent: "center", alignItems: "end", gap: "0.5rem", marginTop: "0.8rem" }}>
          <label className="field" style={{ maxWidth: "12rem", marginBottom: 0 }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
          <button className="btn btn-pink btn-sm" onClick={save}>Save score</button>
        </div>
      )}
      {saved && <p className="small center">Saved ✓</p>}
      {board && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">This week&apos;s best</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{t.score}</b></li>)}</ol> : <p className="small muted">No scores yet this week. Set the first one.</p>}
          <p className="tiny muted">The board starts fresh every Monday.</p>
        </section>
      )}
    </div>
  );
}
