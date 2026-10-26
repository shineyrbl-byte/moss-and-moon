"use client";
import "./page.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { clock } from "@/lib/memory";
import { isSolved, movable, pictureFor, scramble, slide, SLIDE_SIZES, type SlideMode } from "@/lib/slide";
import { itemName, photo } from "@/lib/menu";
import { toDateStr } from "@/lib/cafe";

type Board = { top: { name: string; ms: number; moves: number }[]; mine: { ms: number; moves: number } | null };

export default function Slide() {
  const { menu, lang, toast } = useStore();
  const [mode, setMode] = useState<SlideMode>("easy");
  const [tiles, setTiles] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [peek, setPeek] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const n = SLIDE_SIZES[mode];

  const pool = useMemo(() => menu.filter((m) => ["coffee", "tea", "cold", "bakes"].includes(m.cat) && !m.pup && !m.img.startsWith("/")), [menu]);
  const pic = useMemo(() => pictureFor(pool, toDateStr(new Date())), [pool]);
  const loadBoard = useCallback((m: SlideMode) => fetch(`/api/slide?mode=${m}&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {}), []);
  const newGame = useCallback((m: SlideMode) => {
    setTiles(scramble(SLIDE_SIZES[m]));
    setMoves(0); setStart(null); setDoneMs(null); setSaved(false); setPeek(false);
    loadBoard(m);
  }, [loadBoard]);
  useEffect(() => { newGame(mode); }, [mode, newGame]);
  useEffect(() => { try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {} }, []);
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [start, doneMs]);

  const move = useCallback((pos: number) => {
    if (doneMs !== null || !movable(tiles).includes(pos)) return;
    const t = start ?? Date.now();
    if (!start) { setStart(t); setNow(t); }
    const next = slide(tiles, pos);
    setTiles(next); setMoves((m) => m + 1);
    if (isSolved(next)) setDoneMs(Date.now() - t);
  }, [tiles, start, doneMs]);
  // Arrow keys slide the tile on that side of the gap into it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const gap = tiles.indexOf(0), r = Math.floor(gap / n), c = gap % n;
      const pos = { ArrowUp: r < n - 1 ? gap + n : -1, ArrowDown: r > 0 ? gap - n : -1, ArrowLeft: c < n - 1 ? gap + 1 : -1, ArrowRight: c > 0 ? gap - 1 : -1 }[e.key];
      if (pos === undefined) return;
      e.preventDefault();
      if (pos >= 0) move(pos);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tiles, n, move]);

  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/slide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, ms: doneMs, moves, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  if (!pic) return <div className="page"><p className="muted">Finding today&apos;s picture…</p></div>;
  const src = photo(pic.img, 600);
  const can = movable(tiles);
  const elapsed = doneMs ?? (start ? now - start : 0);
  return (
    <div className="page" style={{ maxWidth: "36rem" }}>
      <p className="eyebrow">a little game</p>
      <h1 className="h2">Slide <em>puzzle</em></h1>
      <p className="small muted">Slide the tiles back into place to finish today&apos;s picture. Tap a tile next to the gap, or use the arrow keys.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {(Object.keys(SLIDE_SIZES) as SlideMode[]).map((m) => <button key={m} className={`chip ${mode === m ? "on" : ""}`} aria-pressed={mode === m} onClick={() => setMode(m)}>{m === "easy" ? "Easy · 3×3" : "Hard · 4×4"}</button>)}
        <span className="memory-stats"><span>⏱ {clock(elapsed)}</span><span>{moves} move{moves === 1 ? "" : "s"}</span></span>
      </div>
      <div className={`slide-board ${doneMs !== null ? "done" : ""}`} style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }} role="group" aria-label={`Slide puzzle of ${itemName(pic, lang)}`}>
        {peek || doneMs !== null ? <span className="slide-full" style={{ backgroundImage: `url(${src})` }} aria-hidden="true" /> : null}
        {tiles.map((t, pos) => {
          if (t === 0) return <span key="gap" className="slide-gap" aria-hidden="true" />;
          const home = t - 1, r = Math.floor(home / n), c = home % n;
          return (
            <button key={t} className="slide-tile" disabled={!can.includes(pos) || doneMs !== null} onClick={() => move(pos)} aria-label={`Tile ${t}`}
              style={{ backgroundImage: `url(${src})`, backgroundSize: `${n * 100}% ${n * 100}%`, backgroundPosition: `${(c / (n - 1)) * 100}% ${(r / (n - 1)) * 100}%` }}>
              <span className="slide-num" aria-hidden="true">{t}</span>
            </button>
          );
        })}
      </div>
      <p className="small center muted" style={{ marginTop: "0.5rem" }}>Today: <b>{itemName(pic, lang)}</b></p>
      <div className="row" style={{ justifyContent: "center", gap: "0.4rem" }}>
        {doneMs === null && <button className="btn btn-ghost btn-sm" onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)} onKeyDown={(e) => e.key === " " && setPeek(true)} onKeyUp={() => setPeek(false)}>👀 Hold to peek</button>}
        <button className="btn btn-ghost btn-sm" onClick={() => newGame(mode)}>Mix it up again</button>
      </div>
      {doneMs !== null && (
        <section className="card memory-done" aria-live="polite">
          <b>Done in {clock(doneMs)} with {moves} moves 🎉</b>
          {!saved ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓ Your best today is {clock(board?.mine?.ms ?? doneMs)}.</p>}
        </section>
      )}
      {board && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">Today&apos;s quickest · {mode === "easy" ? "3×3" : "4×4"}</h2>
          {board.top.length ? (
            <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><span className="muted small">{t.moves} moves</span><b>{clock(t.ms)}</b></li>)}</ol>
          ) : <p className="small muted">No times yet today. Set the first one.</p>}
        </section>
      )}
    </div>
  );
}
