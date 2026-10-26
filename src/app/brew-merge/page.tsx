"use client";
import "./page.css";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { addTile, canMove, slide, SIDE, TILES, type Dir } from "@/lib/merge";

type Board = { top: { name: string; score: number }[]; mine: number | null; best: number | null };
const KEY = "mm-merge";
const fresh = () => addTile(addTile(Array(SIDE * SIDE).fill(0), Math.random), Math.random);

export default function BrewMerge() {
  const { toast } = useStore();
  const [cells, setCells] = useState<number[] | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    let s: { cells?: number[]; score?: number; best?: number; saved?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(KEY) ?? "null"); setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    const ok = s?.cells?.length === SIDE * SIDE;
    setCells(ok ? s!.cells! : fresh()); setScore(ok ? s!.score ?? 0 : 0); setBest(s?.best ?? 0); setSaved(!!(ok && s!.saved));
    fetch(`/api/arcade?game=merge&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  useEffect(() => { if (cells) try { localStorage.setItem(KEY, JSON.stringify({ cells, score, best, saved })); } catch {} }, [cells, score, best, saved]);
  const over = !!cells && !canMove(cells);
  const top = cells ? Math.max(...cells) : 0;

  function go(dir: Dir) {
    if (!cells || over) return;
    const r = slide(cells, dir);
    if (!r.moved) return;
    const next = addTile(r.board, Math.random), s = score + r.gained;
    const newTop = Math.max(...next);
    if (newTop > top && newTop >= 6) toast(`New: ${TILES[newTop - 1].emoji} ${TILES[newTop - 1].name}!`);
    setCells(next); setScore(s); setSaved(false);
    if (s > best) setBest(s);
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const d = ({ ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", a: "left", d: "right", w: "up", s: "down" } as Record<string, Dir>)[e.key];
      if (d) { e.preventDefault(); go(d); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  function restart() { setCells(fresh()); setScore(0); setSaved(false); }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/arcade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "merge", score, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  if (!cells) return <div className="page"><p className="muted">Grinding the beans…</p></div>;
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">an arcade game</p>
      <h1 className="h2">Brew <em>merge</em></h1>
      <p className="small muted">Swipe (or use the arrow keys) to slide every tile. Two of the same drink merge into the next one up, from beans all the way to the 🌙 moon brew. A new tile drops in after every move.</p>
      <div className="memory-stats" style={{ justifyContent: "center", display: "flex" }}><span>Score <b>{score}</b></span><span>Best <b>{best}</b></span></div>
      <div className="mg-grid" role="grid" aria-label={`Brew merge board. Biggest drink: ${top ? TILES[top - 1].name : "none"}`}
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const t = touch.current; touch.current = null;
          if (!t) return;
          const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
          go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
        }}>
        {cells.map((v, p) => (
          <span key={p} className={`mg-cell ${v ? `l${Math.min(v, 11)}` : ""}`} role="gridcell" aria-label={v ? TILES[v - 1].name : "empty"}>
            {v > 0 && <><span className="mg-emoji" aria-hidden="true">{TILES[v - 1].emoji}</span><span className="mg-name" aria-hidden="true">{TILES[v - 1].name}</span></>}
          </span>
        ))}
        {over && <div className="mg-over" aria-live="polite"><b>No moves left</b><span className="small">Score {score}</span></div>}
      </div>
      <div className="mg-pad" role="group" aria-label="Slide">
        <button className="sd-key" onClick={() => go("up")} aria-label="Up">↑</button>
        <button className="sd-key" onClick={() => go("left")} aria-label="Left">←</button>
        <button className="sd-key" onClick={() => go("down")} aria-label="Down">↓</button>
        <button className="sd-key" onClick={() => go("right")} aria-label="Right">→</button>
      </div>
      <div className="row" style={{ justifyContent: "center", alignItems: "end", gap: "0.5rem", marginTop: "0.8rem", flexWrap: "wrap" }}>
        {score > 0 && !saved && (
          <>
            <label className="field" style={{ maxWidth: "12rem", marginBottom: 0 }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
            <button className="btn btn-pink btn-sm" onClick={save}>Save score</button>
          </>
        )}
        {saved && <span className="small">Saved ✓</span>}
        <button className="btn btn-ghost btn-sm" onClick={restart}>New game</button>
      </div>
      <details className="mg-ladder"><summary className="small">The drinks, in order</summary>
        <p className="small">{TILES.map((t) => `${t.emoji} ${t.name}`).join(" → ")}</p>
      </details>
      {board && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">This week&apos;s best</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{t.score.toLocaleString("en-IN")}</b></li>)}</ol> : <p className="small muted">No scores yet this week. Set the first one.</p>}
          <p className="tiny muted">The board starts fresh every Monday.</p>
        </section>
      )}
    </div>
  );
}
