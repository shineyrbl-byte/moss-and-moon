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
import { HINT_MS, nextMark, queensOf, type Mark } from "@/lib/queens";
import { addFlag } from "@/lib/trophyFlags";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-table";
const SECTION = ["rose", "latte", "sage", "butter", "lilac", "sky", "peach", "mint", "stone"];

export default function TableForOne() {
  const { toast } = useStore();
  const [date, setDate] = useState("");
  const past = isPast(date);
  const [marks, setMarks] = useState<Mark[] | null>(null);
  const [history, setHistory] = useState<Mark[][]>([]);
  const [auto, setAuto] = useState(false);
  const [hints, setHints] = useState(0);
  const [hinted, setHinted] = useState<number | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<"daily" | "hard">("daily");
  // Normal is 8×8 with eight guests; hard is 9×9 with nine
  const Q = useMemo(() => queensOf(mode === "hard" ? 9 : 8), [mode]);
  const { N, clashes, isSolved, ruledOut, tableFor, explain } = Q;
  const [why, setWhy] = useState("");
  const store = dayKey(mode === "hard" ? `${KEY}-hard` : KEY);
  const puzzle = useMemo(() => (date ? tableFor(date) : null), [date, tableFor]);
  useEffect(() => {
    const d = playDay();
    setDate(d);
    try { setName(localStorage.getItem("mm-game-name") ?? ""); setAuto(localStorage.getItem("mm-table-auto") === "1"); } catch {}
    try { if (localStorage.getItem("mm-table-mode") === "hard") setMode("hard"); } catch {}
  }, []);
  useEffect(() => { fetch(`/api/daily-scores?game=table&mode=${mode}&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {}); }, [mode]);
  useEffect(() => {
    if (!puzzle) return;
    let s: { date?: string; marks?: Mark[]; hints?: number; start?: number; doneMs?: number; saved?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(store) ?? "null"); } catch {}
    if (s?.date === date && s.marks?.length === N * N) { setMarks(s.marks); setHints(s.hints ?? 0); setStart(s.start ?? null); setDoneMs(s.doneMs ?? null); setSaved(!!s.saved); }
    else { setMarks(Array(N * N).fill(0)); setHints(0); setStart(null); setDoneMs(null); setSaved(false); }
    setHistory([]); setHinted(null);
    setNow(Date.now());
  }, [puzzle, date]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!rp.on && date && marks) try { localStorage.setItem(store, JSON.stringify({ date, marks, hints, start, doneMs, saved })); } catch {} }, [date, marks, hints, start, doneMs, saved]); // eslint-disable-line react-hooks/exhaustive-deps
  const rp = useReplay({ key: store, date, state: marks, setState: setMarks, start, doneMs, first: null });
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [start, doneMs]);
  if (!puzzle || !marks) return <div className="page"><p className="muted">Laying the tables…</p></div>;
  const { regions, seats } = puzzle;
  const done = doneMs !== null;
  const bad = clashes(regions, marks);

  function put(next: Mark[], usedHint = false) {
    const t = start ?? Date.now();
    if (!start) { setStart(t); setNow(t); }
    setHistory([...history, marks!]); setMarks(next);
    if (isSolved(regions, next)) {
      const h = hints + (usedHint ? 1 : 0);
      setDoneMs(Date.now() - t + h * HINT_MS);
      if (!h) addFlag("table-no-hints");
      toast("Everyone has a table to themselves! 🪑🎉");
    }
  }
  function tap(i: number) {
    if (done) return;
    const next = [...marks!];
    next[i] = nextMark(next[i]);
    if (next[i] === 2 && auto) for (const j of ruledOut(regions, i)) if (next[j] === 0) next[j] = 1;
    setHinted(null); setWhy(""); put(next);
  }
  function hint() {
    // Take away a guest in the wrong seat, or else seat the next one
    const wrong = marks!.findIndex((m, i) => m === 2 && !seats.includes(i));
    const next = [...marks!];
    let at: number;
    const step = wrong < 0 ? explain(regions, marks!) : null;
    if (wrong >= 0) { next[wrong] = 0; at = wrong; setWhy("That guest was in the wrong seat, so they've been moved off."); }
    else if (step && seats.includes(step.at)) { at = step.at; next[at] = 2; setWhy(step.why); }
    else { at = seats.find((s) => marks![s] !== 2)!; if (at === undefined) return; next[at] = 2; setWhy("There's no one-step move here (check your crosses), so here's a guest for free."); }
    setHints(hints + 1); setHinted(at); put(next, true);
  }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "table", mode, ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  const elapsed = doneMs ?? (start ? now - start + hints * HINT_MS : 0);
  const seated = marks.filter((m) => m === 2).length;
  // Thicker lines where one section meets another
  const edge = (i: number) => {
    const r = Math.floor(i / N), c = i % N, me = regions[i];
    return `${r > 0 && regions[i - N] !== me ? "et " : ""}${c > 0 && regions[i - 1] !== me ? "el " : ""}${r < N - 1 && regions[i + N] !== me ? "eb " : ""}${c < N - 1 && regions[i + 1] !== me ? "er" : ""}`;
  };
  return (
    <div className="page" style={{ maxWidth: "32rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={date} path="/table-for-one" />
      <h1 className="h2">Table <em>for one</em></h1>
      <p className="small muted">{N === 8 ? "Eight" : "Nine"} guests, and every one wants some space. Seat one guest in every row, every column and every coloured section of the floor. No two guests can sit in touching seats, not even corner to corner. Tap once to cross a seat off, twice to seat a guest. There&apos;s only one answer.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        {(["daily", "hard"] as const).map((m) => <button key={m} className={`chip ${mode === m ? "on" : ""}`} aria-pressed={mode === m} onClick={() => { setMode(m); try { localStorage.setItem("mm-table-mode", m); } catch {} }}>{m === "daily" ? "Normal 8×8" : "Hard 9×9"}</button>)}
        <button className="btn btn-ghost btn-sm" onClick={hint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { const p = history[history.length - 1]; if (p) { setMarks(p); setHistory(history.slice(0, -1)); setHinted(null); } }} disabled={!history.length || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setHistory([...history, marks]); setMarks(Array(N * N).fill(0)); setHinted(null); }} disabled={done || marks.every((m) => !m)}>Start over</button>
        <button className={`chip ${auto ? "on" : ""}`} aria-pressed={auto} onClick={() => { setAuto(!auto); try { localStorage.setItem("mm-table-auto", auto ? "0" : "1"); } catch {} }}>Auto ✕</button>
      </div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>🧑 <b>{seated}</b>/{N} seated</span><span className="mm-clock">⏱ {clock(elapsed)}</span></div>
      <Ghost elapsed={elapsed} done={doneMs !== null} />
      <div className={`tf-grid ${done ? "done" : ""}`} style={{ ["--n" as string]: N }} role="grid" aria-label="Café floor">
        {marks.map((m, i) => (
          <button key={i} className={`tf-cell tf-${SECTION[regions[i]]} ${edge(i)} ${bad.has(i) ? "bad" : ""} ${hinted === i ? "hint" : ""}`} onClick={() => tap(i)} disabled={done}
            aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}, ${SECTION[regions[i]]} section: ${m === 2 ? "guest" : m === 1 ? "crossed off" : "empty"}${bad.has(i) ? ", breaks a rule" : ""}`}>
            {m === 2 ? <span aria-hidden="true">🧑</span> : m === 1 ? <span className="tf-x" aria-hidden="true">✕</span> : null}
          </button>
        ))}
      </div>
      {why && !done && <p className="small center hint-why" role="status">💡 {why}</p>}
      <p className="tiny muted center">Guests who share a row, column or section, or who sit next to each other, turn red. Auto ✕ crosses off the seats a new guest rules out.</p>
      {done && (
        <section className="card memory-done" aria-live="polite">
          <b>Seated in {clock(doneMs)}{hints ? ` (${hints} hint${hints === 1 ? "" : "s"})` : ", no hints"} 🎉</b>
          {past ? <p className="small" style={{ margin: 0 }}>Archive days and practice puzzles don&apos;t go on the board.</p> : !saved ? (
            <div className="row zen-hide" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓</p>}
          <p className="tiny muted" style={{ margin: 0 }}>A new floor plan tomorrow.</p>
          <ShareResult title="Table for one" date={date} score={doneMs} mode={mode} replay={rp.replay} />
        </section>
      )}
      {board && !past && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3" data-zen-board="">Today&apos;s quickest</h2>
          <Difficulty board={board} show={(v) => showDaily("table", v)} />
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{clock(t.ms)}</b></li>)}</ol> : <p className="small muted">No times yet today. Set the first one.</p>}
          <p className="tiny muted">Each hint adds {HINT_MS / 1000} seconds.</p>
        </section>
      )}
    </div>
  );
}
