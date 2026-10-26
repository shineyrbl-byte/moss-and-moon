"use client";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import ArchiveNote from "@/components/ArchiveNote";
import ShareResult from "@/components/ShareResult";
import { dayKey, isPast, playDay } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { HINT_MS, N, isSolved, problems, sumsFor } from "@/lib/kakuro";
import { addFlag } from "@/lib/trophyFlags";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-sums";

export default function BeanSums() {
  const { toast } = useStore();
  const [date, setDate] = useState("");
  const past = isPast(date);
  const [g, setG] = useState<number[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [history, setHistory] = useState<number[][]>([]);
  const [hints, setHints] = useState(0);
  const [hinted, setHinted] = useState<number | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const puzzle = useMemo(() => (date ? sumsFor(date) : null), [date]);
  useEffect(() => {
    setDate(playDay());
    try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    fetch(`/api/daily-scores?game=sums&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  useEffect(() => {
    if (!puzzle) return;
    let s: { date?: string; g?: number[]; hints?: number; start?: number; doneMs?: number; saved?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(dayKey(KEY)) ?? "null"); } catch {}
    if (s?.date === date && s.g?.length === N * N) { setG(s.g); setHints(s.hints ?? 0); setStart(s.start ?? null); setDoneMs(s.doneMs ?? null); setSaved(!!s.saved); }
    else setG([...puzzle.given]);
    setSel(puzzle.white.findIndex((w, i) => w && !puzzle.given[i]));
    setNow(Date.now());
  }, [puzzle, date]);
  useEffect(() => { if (date && g) try { localStorage.setItem(dayKey(KEY), JSON.stringify({ date, g, hints, start, doneMs, saved })); } catch {} }, [date, g, hints, start, doneMs, saved]);
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
    if (isSolved(puzzle!, next)) {
      const h = hints + (usedHint ? 1 : 0);
      setDoneMs(Date.now() - t + h * HINT_MS);
      if (!h) addFlag("sums-no-hints");
      toast("Every sum adds up! ➕🎉");
    }
  }
  function enter(v: number) {
    if (done || !g || sel === null || !puzzle?.white[sel] || puzzle.given[sel] || g[sel] === v) return;
    const next = [...g]; next[sel] = v;
    setHinted(null); put(next);
  }
  function hint() {
    if (!g || !puzzle) return;
    const i = g.findIndex((v, k) => puzzle.white[k] && v !== puzzle.solution[k]);
    if (i < 0) return;
    const next = [...g]; next[i] = puzzle.solution[i];
    setHints(hints + 1); setHinted(i); setSel(i); put(next, true);
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement).tagName;
      if (t === "INPUT" || e.metaKey || e.ctrlKey || done || sel === null || !puzzle) return;
      const step: Record<string, number> = { ArrowUp: -N, ArrowDown: N, ArrowLeft: -1, ArrowRight: 1 };
      if (e.key in step) {
        e.preventDefault();
        // Skip over black squares to the next white one that way
        for (let j = sel + step[e.key]; j >= 0 && j < N * N && (Math.abs(step[e.key]) === N || Math.floor(j / N) === Math.floor(sel / N)); j += step[e.key]) if (puzzle.white[j]) { setSel(j); break; }
      } else if (/^[1-9]$/.test(e.key)) enter(Number(e.key));
      else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") enter(0);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "sums", ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  if (!puzzle || !g) return <div className="page"><p className="muted">Counting the beans…</p></div>;
  const { white, runs, given } = puzzle;
  const bad = problems(puzzle, g);
  const elapsed = doneMs ?? (start ? now - start + hints * HINT_MS : 0);
  const left = white.filter((w, i) => w && !g[i]).length;
  const selRuns = sel === null ? [] : runs.filter((r) => r.cells.includes(sel));
  const inSel = new Set(selRuns.flatMap((r) => r.cells));
  const clueAt = (i: number, across: boolean) => runs.find((r) => r.clue === i && r.across === across);
  return (
    <div className="page" style={{ maxWidth: "32rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={date} path="/bean-sums" />
      <h1 className="h2">Bean <em>sums</em></h1>
      <p className="small muted">Fill every white square with a number from 1 to 9. Each run of squares, across or down, has to add up to the clue at its start (the top number is for across, the bottom one for down), and no number can be used twice in a run. A few squares are filled in to start you off. There&apos;s only one answer.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={hint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { const p = history[history.length - 1]; if (p) { setG(p); setHistory(history.slice(0, -1)); setHinted(null); } }} disabled={!history.length || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setHistory([...history, g]); setG([...given]); setHinted(null); }} disabled={done || g.every((v, i) => v === given[i])}>Start over</button>
      </div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span><b>{left}</b> to fill</span><span>⏱ {clock(elapsed)}</span></div>
      <div className={`ks-grid ${done ? "done" : ""}`} style={{ ["--n" as string]: N }} role="grid" aria-label="Bean sums">
        {[...Array(N * N).keys()].map((i) => {
          if (!white[i]) {
            const a = clueAt(i, true), d = clueAt(i, false);
            return (
              <span key={i} className={`ks-black ${a || d ? "clue" : ""}`} aria-label={a || d ? `${a ? `across adds to ${a.sum}` : ""}${a && d ? ", " : ""}${d ? `down adds to ${d.sum}` : ""}` : undefined}>
                {a && <b className="ks-a">{a.sum}</b>}{d && <b className="ks-d">{d.sum}</b>}
              </span>
            );
          }
          const fixed = !!given[i];
          return (
            <button key={i} className={`ks-cell ${fixed ? "fixed" : ""} ${sel === i ? "sel" : ""} ${inSel.has(i) ? "run" : ""} ${bad.has(i) ? "bad" : ""} ${hinted === i ? "hint" : ""}`} onClick={() => setSel(i)} disabled={done}
              aria-label={`Row ${Math.floor(i / N)}, column ${i % N}: ${g[i] || "empty"}${fixed ? " (given)" : ""}${bad.has(i) ? ", breaks a rule" : ""}`}>
              {g[i] || ""}
            </button>
          );
        })}
      </div>
      <p className="small center" style={{ margin: "0.2rem 0 0.4rem" }} aria-live="polite">
        {!done && selRuns.length ? selRuns.map((r) => `${r.across ? "Across" : "Down"}: ${r.cells.length} squares make ${r.sum}`).join(" · ") : " "}
      </p>
      <div className="ks-pad" aria-label="Numbers">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((v) => <button key={v} className="btn btn-ghost" onClick={() => enter(v)} disabled={done}>{v}</button>)}
        <button className="btn btn-ghost" onClick={() => enter(0)} disabled={done} aria-label="Clear square">⌫</button>
      </div>
      <p className="tiny muted center">Tap a square, then a number. On a keyboard: arrows to move, 1 to 9 to fill, backspace to clear. Repeats, and runs that don&apos;t add up, turn red.</p>
      {done && (
        <section className="card memory-done" aria-live="polite">
          <b>Summed up in {clock(doneMs)}{hints ? ` (${hints} hint${hints === 1 ? "" : "s"})` : ", no hints"} 🎉</b>
          {past ? <p className="small" style={{ margin: 0 }}>Archive days don&apos;t go on the board.</p> : !saved ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓</p>}
          <p className="tiny muted" style={{ margin: 0 }}>New sums tomorrow.</p>
          <ShareResult title="Bean sums" date={date} />
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
