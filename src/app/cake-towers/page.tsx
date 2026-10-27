"use client";
import "./page.css";
import { useEffect, useMemo, useState } from "react";
import ShareResult from "@/components/ShareResult";
import { useReplay } from "@/components/useReplay";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import ArchiveNote from "@/components/ArchiveNote";
import { dayKey, isPast, playDay } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { HINT_MS, N, isSolved, lineFor, problems, towersFor } from "@/lib/skyscrapers";
import { addFlag } from "@/lib/trophyFlags";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-towers";
const SIDE = ["from the top", "from the right", "from the bottom", "from the left"];

export default function CakeTowers() {
  const { toast } = useStore();
  const [date, setDate] = useState("");
  const past = isPast(date);
  const [g, setG] = useState<number[] | null>(null);
  const [sel, setSel] = useState(0);
  const [history, setHistory] = useState<number[][]>([]);
  const [hints, setHints] = useState(0);
  const [hinted, setHinted] = useState<number | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const puzzle = useMemo(() => (date ? towersFor(date) : null), [date]);
  useEffect(() => {
    setDate(playDay());
    try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    fetch(`/api/daily-scores?game=towers&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  useEffect(() => {
    if (!puzzle) return;
    let s: { date?: string; g?: number[]; hints?: number; start?: number; doneMs?: number; saved?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(dayKey(KEY)) ?? "null"); } catch {}
    if (s?.date === date && s.g?.length === N * N) { setG(s.g); setHints(s.hints ?? 0); setStart(s.start ?? null); setDoneMs(s.doneMs ?? null); setSaved(!!s.saved); }
    else setG(Array(N * N).fill(0));
    setNow(Date.now());
  }, [puzzle, date]);
  useEffect(() => { if (!rp.on && date && g) try { localStorage.setItem(dayKey(KEY), JSON.stringify({ date, g, hints, start, doneMs, saved })); } catch {} }, [date, g, hints, start, doneMs, saved]);
  const rp = useReplay({ key: dayKey(KEY), date, state: g, setState: setG, start, doneMs, first: null });
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [start, doneMs]);
  const done = doneMs !== null;

  function put(next: number[], usedHint = false) {
    const t = start ?? Date.now();
    if (!start) { setStart(t); setNow(t); }
    setHistory([...history, g!]); setG(next);
    if (isSolved(puzzle!.clues, next)) {
      const h = hints + (usedHint ? 1 : 0);
      setDoneMs(Date.now() - t + h * HINT_MS);
      if (!h) addFlag("towers-no-hints");
      toast("Every tower in its place! 🎂🎉");
    }
  }
  function enter(v: number) {
    if (done || !g || g[sel] === v) return;
    const next = [...g]; next[sel] = v;
    setHinted(null); put(next);
  }
  function hint() {
    if (!g || !puzzle) return;
    const i = g.findIndex((v, k) => v !== puzzle.solution[k]);
    if (i < 0) return;
    const next = [...g]; next[i] = puzzle.solution[i];
    setHints(hints + 1); setHinted(i); setSel(i); put(next, true);
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement).tagName;
      if (t === "INPUT" || e.metaKey || e.ctrlKey || done) return;
      const r = Math.floor(sel / N), c = sel % N;
      const move: Record<string, number> = { ArrowUp: r > 0 ? sel - N : sel, ArrowDown: r < N - 1 ? sel + N : sel, ArrowLeft: c > 0 ? sel - 1 : sel, ArrowRight: c < N - 1 ? sel + 1 : sel };
      if (e.key in move) { e.preventDefault(); setSel(move[e.key]); }
      else if (/^[1-5]$/.test(e.key)) enter(Number(e.key));
      else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") enter(0);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "towers", ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  if (!puzzle || !g) return <div className="page"><p className="muted">Baking the tiers…</p></div>;
  const { clues } = puzzle;
  const bad = problems(clues, g);
  const elapsed = doneMs ?? (start ? now - start + hints * HINT_MS : 0);
  const left = g.filter((v) => !v).length;
  // The 7×7 layout: clues round the edge, the grid in the middle
  const clueAt = (r: number, c: number): number | null => {
    if (r === 0 && c >= 1 && c <= N) return c - 1;
    if (c === N + 1 && r >= 1 && r <= N) return N + r - 1;
    if (r === N + 1 && c >= 1 && c <= N) return 2 * N + c - 1;
    if (c === 0 && r >= 1 && r <= N) return 3 * N + r - 1;
    return null;
  };
  // The four clues looking along the selected square's row and column
  const near = new Set(clues.flatMap((_, k) => (lineFor(k).includes(sel) ? [k] : [])));
  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={date} path="/cake-towers" />
      <h1 className="h2">Cake <em>towers</em></h1>
      <p className="small muted">Fill the grid with cakes from 1 to 5 tiers tall, each height once in every row and every column. A number round the edge says how many cakes you can see looking in from there: a taller cake hides any shorter ones behind it. There&apos;s only one answer.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={hint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { const p = history[history.length - 1]; if (p) { setG(p); setHistory(history.slice(0, -1)); setHinted(null); } }} disabled={!history.length || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setHistory([...history, g]); setG(Array(N * N).fill(0)); setHinted(null); }} disabled={done || g.every((v) => !v)}>Start over</button>
      </div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span><b>{left}</b> to bake</span><span>⏱ {clock(elapsed)}</span></div>
      <div className={`ct-grid ${done ? "done" : ""}`} role="grid" data-own-keys="" aria-label="Cake towers">
        {[...Array(N + 2).keys()].flatMap((r) => [...Array(N + 2).keys()].map((c) => {
          const k = clueAt(r, c);
          if (k !== null) return (
            <span key={`${r},${c}`} className={`ct-clue ${bad.clues.has(k) ? "bad" : ""} ${near.has(k) && clues[k] ? "near" : ""}`} aria-label={clues[k] ? `${clues[k]} seen ${SIDE[Math.floor(k / N)]}` : undefined}>{clues[k] || ""}</span>
          );
          if (r === 0 || c === 0 || r === N + 1 || c === N + 1) return <span key={`${r},${c}`} aria-hidden="true" />;
          const i = (r - 1) * N + (c - 1), v = g[i];
          return (
            <button key={i} className={`ct-cell ${sel === i ? "sel" : ""} ${bad.cells.has(i) ? "bad" : ""} ${hinted === i ? "hint" : ""}`} onClick={() => setSel(i)} disabled={done}
              aria-label={`Row ${r}, column ${c}: ${v ? `${v} tier${v === 1 ? "" : "s"}` : "empty"}${bad.cells.has(i) ? ", a repeat" : ""}`}>
              {v ? <span className="ct-cake" style={{ ["--h" as string]: v }} aria-hidden="true"><i /><b>{v}</b></span> : null}
            </button>
          );
        }))}
      </div>
      <div className="tj-pad" aria-label="Heights">
        {[1, 2, 3, 4, 5].map((v) => <button key={v} className="btn btn-ghost" onClick={() => enter(v)} disabled={done}>{v}</button>)}
        <button className="btn btn-ghost" onClick={() => enter(0)} disabled={done} aria-label="Clear square">⌫</button>
      </div>
      <p className="tiny muted center">Tap a square, then a height. On a keyboard: arrows to move, 1 to 5 to fill, backspace to clear. The clues for the square you&apos;re on are underlined; repeats and clues that don&apos;t add up turn red.</p>
      {done && (
        <section className="card memory-done" aria-live="polite">
          <b>Baked in {clock(doneMs)}{hints ? ` (${hints} hint${hints === 1 ? "" : "s"})` : ", no hints"} 🎉</b>
          {past ? <p className="small" style={{ margin: 0 }}>Archive days and practice puzzles don&apos;t go on the board.</p> : !saved ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓</p>}
          <p className="tiny muted" style={{ margin: 0 }}>New towers tomorrow.</p>
          <ShareResult title="Cake towers" date={date} score={doneMs} replay={rp.replay} />
        </section>
      )}
      {board && !past && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">Today&apos;s quickest</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{clock(t.ms)}</b></li>)}</ol> : <p className="small muted">No times yet today. Set the first one.</p>}
          <p className="tiny muted">Each hint adds {HINT_MS / 1000} seconds.</p>
        </section>
      )}
    </div>
  );
}
