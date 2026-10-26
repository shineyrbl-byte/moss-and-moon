"use client";
import { useEffect, useMemo, useState } from "react";
import ArchiveNote from "@/components/ArchiveNote";
import { dayKey, isPast, playDay } from "@/lib/archive";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { clock } from "@/lib/memory";
import { clashes, ICON_NAMES, ICONS, isComplete, N, sudokuFor, type SudokuMode } from "@/lib/sudoku";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-sudoku";

export default function Sudoku() {
  const { toast } = useStore();
  const [date, setDate] = useState("");
  const past = isPast(date);
  const [mode, setMode] = useState<SudokuMode>("easy");
  const [cells, setCells] = useState<number[]>([]);
  const [at, setAt] = useState<number | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => { setDate(playDay()); try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {} }, []);
  const puzzle = useMemo(() => (date ? sudokuFor(date, mode).puzzle : null), [date, mode]);
  useEffect(() => {
    if (!puzzle) return;
    let s: { date?: string; cells?: number[]; start?: number; doneMs?: number; saved?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(dayKey(`${KEY}-${mode}`)) ?? "null"); } catch {}
    const fresh = s?.date === date && s.cells?.length === N * N;
    setCells(fresh ? s!.cells! : [...puzzle]);
    setStart(fresh ? s!.start ?? null : null); setNow(Date.now());
    setDoneMs(fresh ? s!.doneMs ?? null : null); setSaved(!!(fresh && s!.saved)); setAt(null);
    fetch(`/api/daily-scores?game=sudoku&mode=${mode}&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, [puzzle, mode, date]);
  useEffect(() => { if (date && cells.length) try { localStorage.setItem(dayKey(`${KEY}-${mode}`), JSON.stringify({ date, cells, start, doneMs, saved })); } catch {} }, [date, mode, cells, start, doneMs, saved]);
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [start, doneMs]);

  const bad = useMemo(() => clashes(cells), [cells]);
  function put(v: number) {
    if (at === null || !puzzle || puzzle[at] || doneMs !== null) return;
    const t = start ?? Date.now();
    if (!start) { setStart(t); setNow(t); }
    const next = cells.map((x, i) => (i === at ? v : x));
    setCells(next);
    if (isComplete(next)) setDoneMs(Date.now() - t);
  }
  // Keyboard: arrows move, 1 to 6 place a picture, Backspace clears
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || at === null) return;
      const moves: Record<string, number> = { ArrowUp: -N, ArrowDown: N, ArrowLeft: -1, ArrowRight: 1 };
      if (e.key in moves) { e.preventDefault(); const n = at + moves[e.key]; if (n >= 0 && n < N * N) setAt(n); }
      else if (/^[1-6]$/.test(e.key)) put(Number(e.key));
      else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") put(0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "sudoku", mode, ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  if (!puzzle || !cells.length) return <div className="page"><p className="muted">Setting the table…</p></div>;
  const elapsed = doneMs ?? (start ? now - start : 0);
  const rowOf = (p: number) => Math.floor(p / N), colOf = (p: number) => p % N;
  return (
    <div className="page" style={{ maxWidth: "36rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={date} path="/sudoku" />
      <h1 className="h2">Mini <em>sudoku</em></h1>
      <p className="small muted">Fill the grid so every row, column and box has each of the six treats once. Tap a square, then a treat. Keyboard works too: arrows and 1 to 6.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {(["easy", "hard"] as SudokuMode[]).map((m) => <button key={m} className={`chip ${mode === m ? "on" : ""}`} aria-pressed={mode === m} onClick={() => setMode(m)}>{m === "easy" ? "Easy" : "Hard"}</button>)}
        <span className="memory-stats"><span>⏱ {clock(elapsed)}</span></span>
      </div>
      <div className={`sd-grid ${doneMs !== null ? "done" : ""}`} role="grid" aria-label="Mini sudoku">
        {cells.map((v, p) => {
          const given = !!puzzle[p];
          const same = at !== null && (rowOf(p) === rowOf(at) || colOf(p) === colOf(at));
          return (
            <button key={p} className={`sd-cell ${given ? "given" : ""} ${at === p ? "at" : same ? "line" : ""} ${bad.has(p) && !given ? "bad" : ""} ${colOf(p) === 2 ? "edge-r" : ""} ${rowOf(p) % 2 === 1 && rowOf(p) < N - 1 ? "edge-b" : ""}`}
              onClick={() => setAt(p)} aria-label={`Row ${rowOf(p) + 1}, column ${colOf(p) + 1}: ${v ? ICON_NAMES[v - 1] : "empty"}${given ? ", given" : ""}`} aria-pressed={at === p}>
              <span aria-hidden="true">{v ? ICONS[v - 1] : ""}</span>
            </button>
          );
        })}
      </div>
      {doneMs === null && (
        <div className="sd-pad" role="group" aria-label="Treats">
          {ICONS.map((ic, i) => <button key={ic} className="sd-key" onClick={() => put(i + 1)} disabled={at === null || !!puzzle[at]} aria-label={ICON_NAMES[i]}>{ic}</button>)}
          <button className="sd-key" onClick={() => put(0)} disabled={at === null || !!puzzle[at]} aria-label="Clear">⌫</button>
        </div>
      )}
      {bad.size > 0 && doneMs === null && <p className="small center" style={{ color: "var(--pink-ink)" }}>Two of the same treat are sharing a row, column or box.</p>}
      {doneMs !== null && (
        <section className="card memory-done" aria-live="polite">
          <b>Solved in {clock(doneMs)} 🎉</b>
          {past ? <p className="small" style={{ margin: 0 }}>Archive days don&apos;t go on the board.</p> : !saved ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓ Your best today is {clock(board?.mine?.ms ?? doneMs)}.</p>}
          <p className="tiny muted" style={{ margin: 0 }}>A new grid tomorrow{mode === "easy" ? ". Fancy trying hard?" : "."}</p>
        </section>
      )}
      {board && !past && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">Today&apos;s quickest · {mode}</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{clock(t.ms)}</b></li>)}</ol> : <p className="small muted">No times yet today. Set the first one.</p>}
        </section>
      )}
    </div>
  );
}
