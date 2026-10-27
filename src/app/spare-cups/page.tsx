"use client";
import "./page.css";
import { Difficulty, Ghost } from "@/components/GameExtras";
import { showDaily } from "@/lib/scoreFormat";
import { useEffect, useMemo, useState } from "react";
import ShareResult from "@/components/ShareResult";
import { useReplay } from "@/components/useReplay";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import ArchiveNote from "@/components/ArchiveNote";
import { dayKey, isPast, playDay } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { HINT_MS, N, cupsFor, isSolved, joined, nextMark, problems, type Mark } from "@/lib/hitori";
import { addFlag } from "@/lib/trophyFlags";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-cups";

export default function SpareCups() {
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
  const puzzle = useMemo(() => (date ? cupsFor(date) : null), [date]);
  useEffect(() => {
    setDate(playDay());
    try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    fetch(`/api/daily-scores?game=cups&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
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
  if (!puzzle || !marks) return <div className="page"><p className="muted">Stacking the cups…</p></div>;
  const { nums, away } = puzzle;
  const done = doneMs !== null;
  const bad = problems(nums, marks);
  const shaded = new Set(marks.flatMap((m, i) => (m === 1 ? [i] : [])));
  const split = shaded.size > 0 && !joined(shaded);

  function put(next: Mark[], usedHint = false) {
    const t = start ?? Date.now();
    if (!start) { setStart(t); setNow(t); }
    setHistory([...history, marks!]); setMarks(next);
    if (isSolved(nums, next)) {
      const h = hints + (usedHint ? 1 : 0);
      setDoneMs(Date.now() - t + h * HINT_MS);
      if (!h) addFlag("cups-no-hints");
      toast("Not a repeat in sight! 🥤🎉");
    }
  }
  function tap(i: number) {
    if (done) return;
    const next = [...marks!]; next[i] = nextMark(next[i]);
    setHinted(null); put(next);
  }
  function hint() {
    // Bring back a cup that shouldn't be away, or else put away the next one that should
    const wrong = marks!.findIndex((m, i) => m === 1 && !away.includes(i));
    const keptWrong = marks!.findIndex((m, i) => m === 2 && away.includes(i));
    const next = [...marks!];
    let at: number;
    if (wrong >= 0) { next[wrong] = 2; at = wrong; }
    else if (keptWrong >= 0) { next[keptWrong] = 1; at = keptWrong; }
    else { at = away.find((i) => marks![i] !== 1)!; if (at === undefined) return; next[at] = 1; }
    setHints(hints + 1); setHinted(at); put(next, true);
  }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "cups", ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  const elapsed = doneMs ?? (start ? now - start + hints * HINT_MS : 0);
  return (
    <div className="page" style={{ maxWidth: "32rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={date} path="/spare-cups" />
      <h1 className="h2">Spare <em>cups</em></h1>
      <p className="small muted">The shelf has too many of some cups. Put cups away until no number shows up twice in any row or column. Two put-away cups can&apos;t sit side by side (corner to corner is fine), and the cups left on the shelf must all join up, across or down. Tap once to put a cup away, twice to mark one you&apos;re sure stays.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={hint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { const p = history[history.length - 1]; if (p) { setMarks(p); setHistory(history.slice(0, -1)); setHinted(null); } }} disabled={!history.length || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setHistory([...history, marks]); setMarks(Array(N * N).fill(0)); setHinted(null); }} disabled={done || marks.every((m) => !m)}>Start over</button>
      </div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>🥤 <b>{shaded.size}</b> put away</span><span className="mm-clock">⏱ {clock(elapsed)}</span></div>
      <Ghost elapsed={elapsed} done={doneMs !== null} />
      <div className={`hc-grid ${done ? "done" : ""}`} style={{ ["--n" as string]: N }} role="grid" aria-label="Cup shelf">
        {nums.map((v, i) => {
          const m = marks[i];
          return (
            <button key={i} className={`hc-cell ${m === 1 ? "away" : m === 2 ? "kept" : ""} ${bad.has(i) ? "bad" : ""} ${hinted === i ? "hint" : ""}`} onClick={() => tap(i)} disabled={done}
              aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}: cup ${v}, ${m === 1 ? "put away" : m === 2 ? "staying" : "on the shelf"}${bad.has(i) ? ", breaks a rule" : ""}`}>
              <span aria-hidden="true">{v}</span>
            </button>
          );
        })}
      </div>
      <p className="tiny muted center" role="status">{split ? "The cups on the shelf have been cut in two: they all need to join up." : "Put-away cups side by side, and two staying cups with the same number in a line, turn red."}</p>
      {done && (
        <section className="card memory-done" aria-live="polite">
          <b>Tidied in {clock(doneMs)}{hints ? ` (${hints} hint${hints === 1 ? "" : "s"})` : ", no hints"} 🎉</b>
          {past ? <p className="small" style={{ margin: 0 }}>Archive days and practice puzzles don&apos;t go on the board.</p> : !saved ? (
            <div className="row zen-hide" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓</p>}
          <p className="tiny muted" style={{ margin: 0 }}>A new shelf tomorrow.</p>
          <ShareResult title="Spare cups" date={date} score={doneMs} replay={rp.replay} />
        </section>
      )}
      {board && !past && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3" data-zen-board="">Today&apos;s quickest</h2>
          <Difficulty board={board} show={(v) => showDaily("cups", v)} />
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{clock(t.ms)}</b></li>)}</ol> : <p className="small muted">No times yet today. Set the first one.</p>}
          <p className="tiny muted">Each hint adds {HINT_MS / 1000} seconds.</p>
        </section>
      )}
    </div>
  );
}
