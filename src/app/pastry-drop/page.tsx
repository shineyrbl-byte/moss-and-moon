"use client";
import "./page.css";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { COLS, NAMES, ROWS, cellsOf, down, hardDrop, hold, landing, newGame, shift, tick, type Kind, type State } from "@/lib/pastryDrop";
import { addFlag } from "@/lib/trophyFlags";

type Board = { top: { name: string; score: number }[]; mine: number | null; best: number | null };
const BEST = "mm-pastry-best";

function Mini({ kind }: { kind: Kind | null }) {
  const cells = kind ? cellsOf({ kind, turn: 0, x: 0, y: 0 }) : [];
  return (
    <span className="pd-mini" role="img" aria-label={kind ? NAMES[kind] : "empty"}>
      {[...Array(8).keys()].map((i) => <i key={i} className={cells.some(([x, y]) => x === i % 4 && y === Math.floor(i / 4)) ? `pd-${kind}` : ""} />)}
    </span>
  );
}

export default function PastryDrop() {
  const { toast } = useStore();
  const [s, setS] = useState<State>(() => newGame(() => 0.5));
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [best, setBest] = useState(0);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const live = useRef(s);
  const touch = useRef<{ x: number; y: number; t: number; moved: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  live.current = s;
  useEffect(() => {
    try { setBest(Number(localStorage.getItem(BEST)) || 0); setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    fetch(`/api/arcade?game=pastry&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  function apply(f: (x: State) => State) {
    if (!playing || paused) return;
    const before = live.current, n = f(before);
    live.current = n; setS(n);
    if (n.cleared.length === 4 && n.lines !== before.lines) { addFlag("pastry-four"); toast("Four rows at once: a full tray! 🥐✨"); }
  }
  useEffect(() => {
    if (!playing || paused || s.over) return;
    let raf = 0, last = performance.now();
    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const before = live.current, n = tick(before, dt);
      if (n !== before) { live.current = n; setS(n); if (n.cleared.length === 4 && n.lines !== before.lines) addFlag("pastry-four"); }
      if (!n.over) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, paused, s.over]);
  useEffect(() => {
    if (!s.over || !playing) return;
    if (s.score > best) { setBest(s.score); try { localStorage.setItem(BEST, String(s.score)); } catch {} if (s.score) toast(`New best: ${s.score}! 🥐`); }
  }, [s.over]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || e.metaKey || e.ctrlKey) return;
      const k = e.key;
      const acts: Record<string, (x: State) => State> = {
        ArrowLeft: (x) => shift(x, -1), ArrowRight: (x) => shift(x, 1), ArrowDown: (x) => down(x, true),
        ArrowUp: (x) => shift(x, 0, 1), x: (x) => shift(x, 0, 1), z: (x) => shift(x, 0, -1), " ": (x) => hardDrop(x), c: hold, Shift: hold,
      };
      if (k === "p") { if (playing && !s.over) setPaused((p) => !p); return; }
      if (!playing && (k === " " || k === "Enter") && tag !== "BUTTON") { e.preventDefault(); begin(); return; }
      const f = acts[k] ?? acts[k.toLowerCase()];
      if (f) { e.preventDefault(); apply(f); }
    };
    const hide = () => { if (document.hidden) setPaused(true); };
    window.addEventListener("keydown", h); document.addEventListener("visibilitychange", hide);
    return () => { window.removeEventListener("keydown", h); document.removeEventListener("visibilitychange", hide); };
  });
  function begin() { const n = newGame(); live.current = n; setS(n); setSaved(false); setPaused(false); setPlaying(true); }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/arcade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "pastry", score: s.score, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  // Touch: drag sideways to move a column at a time, flick down to drop, tap to turn
  function onDown(e: React.PointerEvent) { touch.current = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 }; }
  function onMove(e: React.PointerEvent) {
    const t = touch.current, box = boardRef.current?.getBoundingClientRect();
    if (!t || !box || e.pointerType === "mouse") return;
    const cell = box.width / COLS, steps = Math.trunc((e.clientX - t.x) / cell);
    if (steps !== t.moved) { const d = steps - t.moved; for (let i = 0; i < Math.abs(d); i++) apply((x) => shift(x, Math.sign(d))); t.moved = steps; }
  }
  function onUp(e: React.PointerEvent) {
    const t = touch.current; touch.current = null;
    if (!t) return;
    const dx = e.clientX - t.x, dy = e.clientY - t.y, ms = performance.now() - t.t;
    if (dy > 60 && Math.abs(dy) > Math.abs(dx) * 1.5 && ms < 400) apply((x) => hardDrop(x));
    else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) apply((x) => shift(x, 0, 1));
  }
  const ghost = landing(s);
  const cells: (string | null)[] = s.grid.map((k) => (k ? `pd-${k}` : null));
  if (playing && !s.over) {
    for (const [x, y] of cellsOf(ghost)) if (y >= 0 && !cells[y * COLS + x]) cells[y * COLS + x] = "pd-ghost";
    for (const [x, y] of cellsOf(s.piece)) if (y >= 0) cells[y * COLS + x] = `pd-${s.piece.kind}`;
  }
  return (
    <div className="page" style={{ maxWidth: "32rem" }}>
      <p className="eyebrow">an arcade game</p>
      <h1 className="h2">Pastry <em>drop</em></h1>
      <p className="small muted">Pastries fall onto the tray. Slide and turn them so they fill whole rows: a full row is cleared away. Clear more rows at once for more points. Every ten rows it gets quicker. The tray filling up to the top ends the game.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}>
        <span>Score <b>{s.score}</b></span><span>Rows <b>{s.lines}</b></span><span>Speed <b>{s.level}</b></span><span>Best <b>{best}</b></span>
      </div>
      <div className="pd-layout">
        <div className="pd-wrap">
          <div ref={boardRef} className="pd-board" style={{ ["--cols" as string]: COLS, ["--rows" as string]: ROWS }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} role="img"
            aria-label={`Pastry drop: score ${s.score}, ${s.lines} rows cleared${playing && !s.over ? `, ${NAMES[s.piece.kind]} falling` : ""}`}>
            {cells.map((c, i) => <i key={i} className={c ?? ""} />)}
          </div>
          {(!playing || s.over || paused) && (
            <div className="bb-over">
              {s.over ? <><b>The tray&apos;s full! {s.score} points</b><button className="btn btn-pink btn-sm" onClick={begin}>Bake again</button></>
                : paused ? <><b>Paused</b><button className="btn btn-pink btn-sm" onClick={() => setPaused(false)}>Carry on</button></>
                : <button className="btn btn-pink" onClick={begin}>▶ Start baking</button>}
            </div>
          )}
        </div>
        <aside className="pd-side">
          <span className="tiny muted">Next</span>
          {s.next.slice(0, 3).map((k, i) => <Mini key={i} kind={playing ? k : null} />)}
          <span className="tiny muted" style={{ marginTop: "0.5rem" }}>Held</span>
          <Mini kind={s.hold} />
        </aside>
      </div>
      <div className="pd-pad" aria-label="Controls">
        <button className="btn btn-ghost btn-sm" onClick={() => apply((x) => shift(x, -1))} aria-label="Left">◀</button>
        <button className="btn btn-ghost btn-sm" onClick={() => apply((x) => shift(x, 0, 1))} aria-label="Turn">⟳</button>
        <button className="btn btn-ghost btn-sm" onClick={() => apply((x) => shift(x, 1))} aria-label="Right">▶</button>
        <button className="btn btn-ghost btn-sm" onClick={() => apply((x) => down(x, true))} aria-label="Down one">▼</button>
        <button className="btn btn-ghost btn-sm" onClick={() => apply((x) => hardDrop(x))} aria-label="Drop">⤓</button>
        <button className="btn btn-ghost btn-sm" onClick={() => apply(hold)} aria-label="Hold">Hold</button>
      </div>
      {s.over && s.score > 0 && !saved && (
        <div className="row" style={{ justifyContent: "center", alignItems: "end", gap: "0.5rem", marginTop: "0.6rem" }}>
          <label className="field" style={{ maxWidth: "12rem", marginBottom: 0 }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
          <button className="btn btn-pink btn-sm" onClick={save}>Save score</button>
        </div>
      )}
      {saved && <p className="small center">Saved ✓</p>}
      <p className="tiny muted center">Keys: ← → to slide, ↑ or X to turn (Z turns back), ↓ to nudge down, space to drop, C to hold one for later, P to pause. On a phone: drag to slide, tap to turn, flick down to drop.</p>
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
