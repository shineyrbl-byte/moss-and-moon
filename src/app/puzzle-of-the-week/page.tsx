"use client";
import "./page.css";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import ShareResult from "@/components/ShareResult";
import { clock } from "@/lib/memory";
import { toDateStr } from "@/lib/cafe";
import { weekOf } from "@/lib/polls";
import { HINT_MS, candidates, clashes, isSolved, weeklyFor } from "@/lib/sudoku9";
import { addFlag } from "@/lib/trophyFlags";

type Board = { week: string; top: { name: string; ms: number }[]; mine: number | null; friends: { name: string; ms: number | null }[]; played: number };
const KEY = "mm-weekly";

export default function PuzzleOfTheWeek() {
  const { toast } = useStore();
  const [week, setWeek] = useState("");
  const [g, setG] = useState<number[] | null>(null);
  const [notes, setNotes] = useState<number[]>(Array(81).fill(0)); // a bit for each pencil mark
  const [pencil, setPencil] = useState(false);
  const [sel, setSel] = useState(0);
  const [history, setHistory] = useState<{ g: number[]; notes: number[] }[]>([]);
  const [hints, setHints] = useState(0);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const puzzle = useMemo(() => (week ? weeklyFor(week) : null), [week]);
  useEffect(() => {
    const w = weekOf(toDateStr(new Date()));
    setWeek(w);
    try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    fetch(`/api/weekly?voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  useEffect(() => {
    if (!puzzle) return;
    let s: { week?: string; g?: number[]; notes?: number[]; hints?: number; start?: number; doneMs?: number; saved?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch {}
    if (s?.week === week && s.g?.length === 81) { setG(s.g); setNotes(s.notes ?? Array(81).fill(0)); setHints(s.hints ?? 0); setStart(s.start ?? null); setDoneMs(s.doneMs ?? null); setSaved(!!s.saved); }
    else setG([...puzzle.puzzle]);
    setSel(puzzle.puzzle.findIndex((v) => !v));
    setNow(Date.now());
  }, [puzzle, week]);
  useEffect(() => { if (week && g) try { localStorage.setItem(KEY, JSON.stringify({ week, g, notes, hints, start, doneMs, saved })); } catch {} }, [week, g, notes, hints, start, doneMs, saved]);
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [start, doneMs]);
  const done = doneMs !== null;

  function put(next: number[], nextNotes = notes, usedHint = false) {
    const t = start ?? Date.now();
    if (!start) { setStart(t); setNow(t); }
    setHistory([...history.slice(-200), { g: g!, notes }]); setG(next); setNotes(nextNotes);
    if (isSolved(next)) {
      const h = hints + (usedHint ? 1 : 0);
      setDoneMs(Date.now() - t + h * HINT_MS);
      if (!h) addFlag("weekly-no-hints");
      toast("The week's puzzle, solved! 🗓🎉");
    }
  }
  function enter(v: number) {
    if (done || !g || !puzzle || puzzle.puzzle[sel]) return;
    if (pencil && v) { const n = [...notes]; n[sel] ^= 1 << v; setHistory([...history, { g, notes }]); setNotes(n); return; }
    if (g[sel] === v) return;
    const next = [...g]; next[sel] = v;
    // Placing a number clears it from the pencil marks it rules out
    const n = [...notes]; n[sel] = 0;
    if (v) for (let j = 0; j < 81; j++) if (Math.floor(j / 9) === Math.floor(sel / 9) || j % 9 === sel % 9 || (Math.floor(j / 27) === Math.floor(sel / 27) && Math.floor((j % 9) / 3) === Math.floor((sel % 9) / 3))) n[j] &= ~(1 << v);
    put(next, n);
  }
  function hint() {
    if (!g || !puzzle) return;
    const i = g.findIndex((v, k) => v !== puzzle.answer[k]);
    if (i < 0) return;
    const next = [...g]; next[i] = puzzle.answer[i];
    setHints(hints + 1); setSel(i); put(next, notes, true);
  }
  function fillNotes() {
    if (!g || done) return;
    setHistory([...history, { g, notes }]);
    setNotes(g.map((v, i) => (v ? 0 : candidates(g, i).reduce((m, c) => m | (1 << c), 0))));
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || e.metaKey || e.ctrlKey || done) return;
      const r = Math.floor(sel / 9), c = sel % 9;
      const mv: Record<string, number> = { ArrowUp: r ? sel - 9 : sel, ArrowDown: r < 8 ? sel + 9 : sel, ArrowLeft: c ? sel - 1 : sel, ArrowRight: c < 8 ? sel + 1 : sel };
      if (e.key in mv) { e.preventDefault(); setSel(mv[e.key]); }
      else if (/^[1-9]$/.test(e.key)) enter(Number(e.key));
      else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") enter(0);
      else if (e.key === "p" || e.key === "n") setPencil((x) => !x);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/weekly", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  if (!puzzle || !g) return <div className="page"><p className="muted">Setting out the big grid…</p></div>;
  const bad = clashes(g);
  const elapsed = doneMs ?? (start ? now - start + hints * HINT_MS : 0);
  const selVal = g[sel];
  const left = g.filter((v) => !v).length;
  const ends = new Date(new Date(`${week}T12:00:00`).getTime() + 6 * 86_400_000).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">this week&apos;s challenge</p>
      <h1 className="h2">Puzzle of <em>the week</em></h1>
      <p className="small muted">A proper 9×9 sudoku, harder than the dailies and the same for everyone until {ends}. Each number once in every row, column and 3×3 box. Take it slowly over a few coffees: your progress is saved.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className={`chip ${pencil ? "on" : ""}`} aria-pressed={pencil} onClick={() => setPencil(!pencil)}>✏️ Pencil marks</button>
        <button className="btn btn-ghost btn-sm" onClick={fillNotes} disabled={done}>Fill in all marks</button>
        <button className="btn btn-ghost btn-sm" onClick={hint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { const p = history[history.length - 1]; if (p) { setG(p.g); setNotes(p.notes); setHistory(history.slice(0, -1)); } }} disabled={!history.length || done}>↩ Undo</button>
      </div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span><b>{left}</b> to fill</span><span>⏱ {clock(elapsed)}</span></div>
      <div className={`s9-grid ${done ? "done" : ""}`} role="grid" data-own-keys="" aria-label="Weekly sudoku">
        {g.map((v, i) => {
          const fixed = !!puzzle.puzzle[i];
          const same = !!selVal && v === selVal;
          return (
            <button key={i} className={`s9-cell ${fixed ? "fixed" : ""} ${sel === i ? "sel" : ""} ${same ? "same" : ""} ${bad.has(i) ? "bad" : ""} ${i % 9 === 2 || i % 9 === 5 ? "br" : ""} ${Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5 ? "bb" : ""}`}
              onClick={() => setSel(i)} disabled={done} aria-label={`Row ${Math.floor(i / 9) + 1}, column ${(i % 9) + 1}: ${v || "empty"}${fixed ? " (given)" : ""}`}>
              {v ? v : notes[i] ? <span className="s9-notes" aria-hidden="true">{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => <i key={d}>{notes[i] & (1 << d) ? d : ""}</i>)}</span> : ""}
            </button>
          );
        })}
      </div>
      <div className="ks-pad" aria-label="Numbers">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((v) => <button key={v} className="btn btn-ghost" onClick={() => enter(v)} disabled={done}>{v}</button>)}
        <button className="btn btn-ghost" onClick={() => enter(0)} disabled={done} aria-label="Clear square">⌫</button>
      </div>
      <p className="tiny muted center">Tap a square, then a number. Pencil marks (P on a keyboard) jot down possibilities without filling the square in.</p>
      {done && (
        <section className="card memory-done" aria-live="polite">
          <b>Solved in {clock(doneMs)}{hints ? ` (${hints} hint${hints === 1 ? "" : "s"})` : ", no hints"} 🎉</b>
          {!saved ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓</p>}
          <p className="tiny muted" style={{ margin: 0 }}>A new one every Monday.</p>
          <ShareResult title="Puzzle of the week" date={week} />
        </section>
      )}
      {board && (
        <section style={{ marginTop: "1.4rem" }}>
          {board.friends.length > 0 && (<>
            <h2 className="h3">You vs your friends</h2>
            <ol className="memory-board">
              {[...board.friends.map((f) => ({ ...f, me: false })), { name: "You", ms: board.mine, me: true }].sort((a, b) => (a.ms ?? Infinity) - (b.ms ?? Infinity)).map((f, i) => (
                <li key={i} className={f.me ? "me" : ""}><span>{f.name}</span><b>{f.ms !== null ? clock(f.ms) : "not yet"}</b></li>
              ))}
            </ol>
          </>)}
          <h2 className="h3">This week&apos;s quickest</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{clock(t.ms)}</b></li>)}</ol> : <p className="small muted">No times yet this week. Set the first one.</p>}
          <p className="tiny muted">{board.played} {board.played === 1 ? "person has" : "people have"} finished it this week. <Link href="/friends">Add friends</Link> to race them.</p>
        </section>
      )}
    </div>
  );
}
