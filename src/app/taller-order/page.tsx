"use client";
import "./page.css";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import ArchiveNote from "@/components/ArchiveNote";
import ShareResult from "@/components/ShareResult";
import { useReplay } from "@/components/useReplay";
import { dayKey, isPast, playDay } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { HINT_MS, N, isSolved, problems, tallerFor } from "@/lib/futoshiki";
import { addFlag } from "@/lib/trophyFlags";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-taller";

export default function TallerOrder() {
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
  const puzzle = useMemo(() => (date ? tallerFor(date) : null), [date]);
  useEffect(() => {
    setDate(playDay());
    try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    fetch(`/api/daily-scores?game=taller&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  useEffect(() => {
    if (!puzzle) return;
    let s: { date?: string; g?: number[]; hints?: number; start?: number; doneMs?: number; saved?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(dayKey(KEY)) ?? "null"); } catch {}
    if (s?.date === date && s.g?.length === N * N) { setG(s.g); setHints(s.hints ?? 0); setStart(s.start ?? null); setDoneMs(s.doneMs ?? null); setSaved(!!s.saved); }
    else setG([...puzzle.given]);
    setSel(puzzle.given.findIndex((v) => !v));
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
    if (isSolved(puzzle!.signs, next)) {
      const h = hints + (usedHint ? 1 : 0);
      setDoneMs(Date.now() - t + h * HINT_MS);
      if (!h) addFlag("taller-no-hints");
      toast("Every sign holds! 📏🎉");
    }
  }
  function enter(v: number) {
    if (done || !g || !puzzle || puzzle.given[sel] || g[sel] === v) return;
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
      if ((e.target as HTMLElement).tagName === "INPUT" || e.metaKey || e.ctrlKey || done) return;
      const r = Math.floor(sel / N), c = sel % N;
      const mv: Record<string, number> = { ArrowUp: r ? sel - N : sel, ArrowDown: r < N - 1 ? sel + N : sel, ArrowLeft: c ? sel - 1 : sel, ArrowRight: c < N - 1 ? sel + 1 : sel };
      if (e.key in mv) { e.preventDefault(); setSel(mv[e.key]); }
      else if (/^[1-5]$/.test(e.key)) enter(Number(e.key));
      else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") enter(0);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "taller", ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  if (!puzzle || !g) return <div className="page"><p className="muted">Lining up the cups…</p></div>;
  const { signs, given } = puzzle;
  const bad = problems(signs, g);
  const elapsed = doneMs ?? (start ? now - start + hints * HINT_MS : 0);
  const signAt = (a: number, b: number) => signs.findIndex((s) => s.a === a && s.b === b);
  const S = 2 * N - 1;
  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={date} path="/taller-order" />
      <h1 className="h2">Taller <em>order</em></h1>
      <p className="small muted">Fill the grid with 1 to 5, each once in every row and every column. Every sign between two squares has to be true: the narrow end points at the smaller number. A few are filled in for you. There&apos;s only one answer.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={hint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { const p = history[history.length - 1]; if (p) { setG(p); setHistory(history.slice(0, -1)); setHinted(null); } }} disabled={!history.length || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setHistory([...history, g]); setG([...given]); setHinted(null); }} disabled={done}>Start over</button>
      </div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span><b>{g.filter((v) => !v).length}</b> to fill</span><span>⏱ {clock(elapsed)}</span></div>
      <div className={`to-grid ${done ? "done" : ""}`} style={{ ["--s" as string]: S }} role="grid" data-own-keys="" aria-label="Taller order">
        {[...Array(S * S).keys()].map((k) => {
          const R = Math.floor(k / S), C = k % S;
          if (R % 2 === 0 && C % 2 === 0) {
            const i = (R / 2) * N + C / 2, fixed = !!given[i];
            return (
              <button key={k} className={`to-cell ${fixed ? "fixed" : ""} ${sel === i ? "sel" : ""} ${bad.cells.has(i) ? "bad" : ""} ${hinted === i ? "hint" : ""}`} onClick={() => setSel(i)} disabled={done}
                aria-label={`Row ${R / 2 + 1}, column ${C / 2 + 1}: ${g[i] || "empty"}${fixed ? " (given)" : ""}`}>{g[i] || ""}</button>
            );
          }
          if (R % 2 === 0) { const a = (R / 2) * N + (C - 1) / 2, s = signAt(a, a + 1); return <span key={k} className={`to-sign ${s >= 0 && bad.signs.has(s) ? "bad" : ""}`} aria-hidden="true">{s >= 0 ? (signs[s].lt ? "<" : ">") : ""}</span>; }
          if (C % 2 === 0) { const a = ((R - 1) / 2) * N + C / 2, s = signAt(a, a + N); return <span key={k} className={`to-sign v ${s >= 0 && bad.signs.has(s) ? "bad" : ""}`} aria-hidden="true">{s >= 0 ? (signs[s].lt ? "∧" : "∨") : ""}</span>; }
          return <span key={k} aria-hidden="true" />;
        })}
      </div>
      <div className="tj-pad" aria-label="Numbers">
        {[1, 2, 3, 4, 5].map((v) => <button key={v} className="btn btn-ghost" onClick={() => enter(v)} disabled={done}>{v}</button>)}
        <button className="btn btn-ghost" onClick={() => enter(0)} disabled={done} aria-label="Clear square">⌫</button>
      </div>
      <p className="tiny muted center">Tap a square, then a number, or use the arrows and 1 to 5. Repeats and signs that don&apos;t hold turn red.</p>
      {done && (
        <section className="card memory-done" aria-live="polite">
          <b>In order in {clock(doneMs)}{hints ? ` (${hints} hint${hints === 1 ? "" : "s"})` : ", no hints"} 🎉</b>
          {past ? <p className="small" style={{ margin: 0 }}>Archive days and practice puzzles don&apos;t go on the board.</p> : !saved ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓</p>}
          <ShareResult title="Taller order" date={date} score={doneMs} replay={rp.replay} />
        </section>
      )}
      {board && !past && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">Today&apos;s quickest</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{clock(t.ms)}</b></li>)}</ol> : <p className="small muted">No times yet today. Set the first one.</p>}
        </section>
      )}
    </div>
  );
}
