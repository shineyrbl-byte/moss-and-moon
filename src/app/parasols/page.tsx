"use client";
import "./page.css";
import { Difficulty, Ghost } from "@/components/GameExtras";
import { showDaily } from "@/lib/scoreFormat";
import { useEffect, useMemo, useState } from "react";
import ShareResult from "@/components/ShareResult";
import { useReplay } from "@/components/useReplay";
import ArchiveNote from "@/components/ArchiveNote";
import { dayKey, isPast, playDay } from "@/lib/archive";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { clock } from "@/lib/memory";
import { HINT_MS, N, clashes, isSolved, lineCount, nextMark, terraceFor, type Mark } from "@/lib/tents";
import { addFlag } from "@/lib/trophyFlags";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-parasols";

export default function Parasols() {
  const { toast } = useStore();
  const [date, setDate] = useState("");
  const past = isPast(date);
  const [marks, setMarks] = useState<Mark[] | null>(null);
  const [history, setHistory] = useState<Mark[][]>([]);
  const [hints, setHints] = useState(0);
  const [hinted, setHinted] = useState<number | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const puzzle = useMemo(() => (date ? terraceFor(date) : null), [date]);
  useEffect(() => {
    const d = playDay();
    setDate(d);
    try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    fetch(`/api/daily-scores?game=parasols&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  useEffect(() => {
    if (!puzzle) return;
    let s: { date?: string; marks?: Mark[]; hints?: number; start?: number; doneMs?: number; saved?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(dayKey(KEY)) ?? "null"); } catch {}
    if (s?.date === date && s.marks?.length === N * N) { setMarks(s.marks); setHints(s.hints ?? 0); setStart(s.start ?? null); setDoneMs(s.doneMs ?? null); setSaved(!!s.saved); }
    else setMarks(Array(N * N).fill(0));
    setNow(Date.now());
  }, [puzzle, date]);
  useEffect(() => { if (!rp.on && date && marks) try { localStorage.setItem(dayKey(KEY), JSON.stringify({ date, marks, hints, start, doneMs, saved })); } catch {} }, [date, marks, hints, start, doneMs, saved]);
  const rp = useReplay({ key: dayKey(KEY), date, state: marks, setState: setMarks, start, doneMs, first: null });
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [start, doneMs]);
  if (!puzzle || !marks) return <div className="page"><p className="muted">Wiping down the terrace…</p></div>;
  const { tables, parasols, rows, cols } = puzzle;
  const done = doneMs !== null;
  const bad = clashes(tables, marks);

  function put(next: Mark[], usedHint = false) {
    const t = start ?? Date.now();
    if (!start) { setStart(t); setNow(t); }
    setHistory([...history, marks!]); setMarks(next);
    if (isSolved(puzzle!, next)) {
      const h = hints + (usedHint ? 1 : 0);
      setDoneMs(Date.now() - t + h * HINT_MS);
      if (!h) addFlag("parasols-no-hints");
      toast("Shade for every table! ⛱️🎉");
    }
  }
  function tap(i: number) {
    if (done || tables.includes(i)) return;
    const next = [...marks!]; next[i] = nextMark(next[i]);
    setHinted(null); put(next);
  }
  /** Tapping a number fills the rest of that line with grass, once it has all its parasols */
  function fillLine(k: number, row: boolean) {
    if (done || lineCount(marks!, k, row) !== (row ? rows : cols)[k]) return;
    const next = marks!.map((m, i) => ((row ? Math.floor(i / N) : i % N) === k && m === 0 && !tables.includes(i) ? 1 : m)) as Mark[];
    if (next.some((m, i) => m !== marks![i])) put(next);
  }
  function hint() {
    const wrong = marks!.findIndex((m, i) => m === 2 && !parasols.includes(i));
    const next = [...marks!];
    let at: number;
    if (wrong >= 0) { next[wrong] = 0; at = wrong; }
    else { at = parasols.find((p) => marks![p] !== 2)!; if (at === undefined) return; next[at] = 2; }
    setHints(hints + 1); setHinted(at); put(next, true);
  }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "parasols", ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  const elapsed = doneMs ?? (start ? now - start + hints * HINT_MS : 0);
  const placed = marks.filter((m) => m === 2).length;
  const countCls = (have: number, want: number) => (have === want ? "met" : have > want ? "over" : "");
  return (
    <div className="page" style={{ maxWidth: "32rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={date} path="/parasols" />
      <h1 className="h2">Para<em>sols</em></h1>
      <p className="small muted">Every table on the terrace needs its own parasol, in a square right beside it (across or down, not corner to corner). Parasols can&apos;t touch each other, not even at the corners. The numbers say how many parasols go in each row and column. Tap once for grass, twice for a parasol. There&apos;s only one answer.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={hint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { const p = history[history.length - 1]; if (p) { setMarks(p); setHistory(history.slice(0, -1)); setHinted(null); } }} disabled={!history.length || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setHistory([...history, marks]); setMarks(Array(N * N).fill(0)); setHinted(null); }} disabled={done || marks.every((m) => !m)}>Start over</button>
      </div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>⛱️ <b>{placed}</b>/{tables.length} up</span><span className="mm-clock">⏱ {clock(elapsed)}</span></div>
      <Ghost elapsed={elapsed} done={doneMs !== null} />
      <div className={`ps-grid ${done ? "done" : ""}`} style={{ ["--n" as string]: N }} role="group" data-grid="" aria-label="Terrace">
        <span aria-hidden="true" />
        {cols.map((n, c) => (
          <button key={`c${c}`} className={`ps-count ${countCls(lineCount(marks, c, false), n)}`} onClick={() => fillLine(c, false)} disabled={done}
            aria-label={`Column ${c + 1} needs ${n}, has ${lineCount(marks, c, false)}. Tap to fill the rest with grass.`}>{n}</button>
        ))}
        {[...Array(N).keys()].map((r) => [
          <button key={`r${r}`} className={`ps-count ${countCls(lineCount(marks, r, true), rows[r])}`} onClick={() => fillLine(r, true)} disabled={done}
            aria-label={`Row ${r + 1} needs ${rows[r]}, has ${lineCount(marks, r, true)}. Tap to fill the rest with grass.`}>{rows[r]}</button>,
          ...[...Array(N).keys()].map((c) => {
            const i = r * N + c, table = tables.includes(i), m = marks[i];
            return (
              <button key={i} className={`ps-cell ${table ? "table" : m === 1 ? "grass" : m === 2 ? "shade" : ""} ${bad.has(i) ? "bad" : ""} ${hinted === i ? "hint" : ""}`} onClick={() => tap(i)} disabled={done || table}
                aria-label={`Row ${r + 1}, column ${c + 1}: ${table ? "table" : m === 2 ? "parasol" : m === 1 ? "grass" : "empty"}${bad.has(i) ? ", breaks a rule" : ""}`}>
                {table ? <i className="ps-table" aria-hidden="true" /> : m === 2 ? <span aria-hidden="true">⛱️</span> : null}
              </button>
            );
          }),
        ])}
      </div>
      <p className="tiny muted center">A number turns green when its line is done: tap it to fill the rest with grass. Parasols that touch, or aren&apos;t next to a table, turn red.</p>
      {done && (
        <section className="card memory-done" aria-live="polite">
          <b>Shaded in {clock(doneMs)}{hints ? ` (${hints} hint${hints === 1 ? "" : "s"})` : ", no hints"} 🎉</b>
          {past ? <p className="small" style={{ margin: 0 }}>Archive days and practice puzzles don&apos;t go on the board.</p> : !saved ? (
            <div className="row zen-hide" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓</p>}
          <p className="tiny muted" style={{ margin: 0 }}>A new terrace tomorrow.</p>
          <ShareResult title="Parasols" date={date} score={doneMs} replay={rp.replay} />
        </section>
      )}
      {board && !past && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3" data-zen-board="">Today&apos;s quickest</h2>
          <Difficulty board={board} show={(v) => showDaily("parasols", v)} />
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{clock(t.ms)}</b></li>)}</ol> : <p className="small muted">No times yet today. Set the first one.</p>}
          <p className="tiny muted">Each hint adds {HINT_MS / 1000} seconds.</p>
        </section>
      )}
    </div>
  );
}
