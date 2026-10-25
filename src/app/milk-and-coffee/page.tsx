"use client";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { clock } from "@/lib/memory";
import { HINT_MS, N, clashes, isSolved, milkFor, nextValue, type Cell } from "@/lib/binairo";
import { toDateStr } from "@/lib/cafe";
import { addFlag } from "@/lib/trophyFlags";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-milk";
const NAME: Record<number, string> = { 0: "milk", 1: "coffee", [-1]: "empty" };

export default function MilkAndCoffee() {
  const { toast } = useStore();
  const [date, setDate] = useState("");
  const [cells, setCells] = useState<Cell[] | null>(null);
  const [history, setHistory] = useState<Cell[][]>([]);
  const [hints, setHints] = useState(0);
  const [hinted, setHinted] = useState<number | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const puzzle = useMemo(() => (date ? milkFor(date) : null), [date]);
  useEffect(() => {
    const d = toDateStr(new Date());
    setDate(d);
    try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    fetch(`/api/daily-scores?game=milk&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  useEffect(() => {
    if (!puzzle) return;
    let s: { date?: string; cells?: Cell[]; hints?: number; start?: number; doneMs?: number; saved?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch {}
    if (s?.date === date && s.cells?.length === N * N) { setCells(s.cells); setHints(s.hints ?? 0); setStart(s.start ?? null); setDoneMs(s.doneMs ?? null); setSaved(!!s.saved); }
    else setCells([...puzzle.given]);
    setNow(Date.now());
  }, [puzzle, date]);
  useEffect(() => { if (date && cells) try { localStorage.setItem(KEY, JSON.stringify({ date, cells, hints, start, doneMs, saved })); } catch {} }, [date, cells, hints, start, doneMs, saved]);
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [start, doneMs]);
  if (!puzzle || !cells) return <div className="page"><p className="muted">Warming the milk…</p></div>;
  const done = doneMs !== null;
  const bad = clashes(cells);

  function put(next: Cell[], extra = 0) {
    const t = start ?? Date.now();
    if (!start) { setStart(t); setNow(t); }
    setHistory([...history, cells!]); setCells(next);
    if (isSolved(next)) {
      setDoneMs(Date.now() - t + (hints * HINT_MS) + extra);
      if (!hints && !extra) addFlag("milk-no-hints");
      toast("Every row half and half! ☕🥛🎉");
    }
  }
  function tap(i: number) {
    if (done || puzzle!.given[i] !== -1) return;
    const next = [...cells!]; next[i] = nextValue(next[i]);
    setHinted(null); put(next);
  }
  function hint() {
    // Fix the first cup that's wrong, or else fill the first gap
    const wrong = cells!.findIndex((v, i) => v !== -1 && v !== puzzle!.solution[i]);
    const i = wrong >= 0 ? wrong : cells!.indexOf(-1);
    if (i < 0) return;
    const next = [...cells!]; next[i] = puzzle!.solution[i];
    setHints(hints + 1); setHinted(i); put(next, HINT_MS);
  }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "milk", ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  const elapsed = doneMs ?? (start ? now - start + hints * HINT_MS : 0);
  const left = cells.filter((v) => v === -1).length;
  return (
    <div className="page" style={{ maxWidth: "32rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <h1 className="h2">Milk &amp; <em>coffee</em></h1>
      <p className="small muted">Fill every square with a glass of milk or a cup of coffee. Never three of the same in a row, across or down, and every row and every column has four of each. Tap a square to go milk, coffee, empty. There&apos;s only one answer.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={hint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { const p = history[history.length - 1]; if (p) { setCells(p); setHistory(history.slice(0, -1)); setHinted(null); } }} disabled={!history.length || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setHistory([...history, cells]); setCells([...puzzle.given]); setHinted(null); }} disabled={done}>Start over</button>
      </div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span><b>{left}</b> to fill</span><span>⏱ {clock(elapsed)}</span></div>
      <div className={`mk-grid ${done ? "done" : ""}`} style={{ ["--n" as string]: N }} role="grid" aria-label="Milk and coffee grid">
        {cells.map((v, i) => {
          const fixed = puzzle.given[i] !== -1;
          return (
            <button key={i} className={`mk-cell ${fixed ? "fixed" : ""} ${bad.has(i) ? "bad" : ""} ${hinted === i ? "hint" : ""}`} onClick={() => tap(i)} disabled={done || fixed}
              aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}: ${NAME[v]}${fixed ? " (given)" : ""}${bad.has(i) ? ", breaks a rule" : ""}`}>
              {v !== -1 && <i className={`mk-cup ${v ? "coffee" : "milk"}`} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <p className="tiny muted center"><i className="mk-cup milk mk-key" aria-hidden="true" /> milk · <i className="mk-cup coffee mk-key" aria-hidden="true" /> coffee · squares that break a rule turn red</p>
      {done && (
        <section className="card memory-done" aria-live="polite">
          <b>Solved in {clock(doneMs)}{hints ? ` (${hints} hint${hints === 1 ? "" : "s"})` : ", no hints"} 🎉</b>
          {!saved ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓</p>}
          <p className="tiny muted" style={{ margin: 0 }}>A new grid tomorrow.</p>
        </section>
      )}
      {board && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">Today&apos;s quickest</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{clock(t.ms)}</b></li>)}</ol> : <p className="small muted">No times yet today. Set the first one.</p>}
          <p className="tiny muted">Each hint adds {HINT_MS / 1000} seconds.</p>
        </section>
      )}
    </div>
  );
}
