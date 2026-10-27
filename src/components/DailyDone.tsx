"use client";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import ShareResult from "@/components/ShareResult";
import { Difficulty } from "@/components/GameExtras";
import { dayKey, playDay } from "@/lib/archive";
import { useReplay, type Replay } from "@/components/useReplay";

export type DailyBoard = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number; median?: number | null; usual?: number | null };

/** The "done" card for a daily puzzle: the headline, saving to today's board (not for archive days) and sharing */
export function DoneCard({ game, title, date, past, headline, score, saved, onSaved, replay, proof, children }: {
  game: string; title: string; date: string; past: boolean; headline: string; score: number; saved: boolean;
  onSaved: (board: DailyBoard) => void; replay?: Replay; proof?: unknown; children?: React.ReactNode;
}) {
  const { toast } = useStore();
  const [name, setName] = useState("");
  useEffect(() => { try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {} }, []);
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game, ms: score, name, voter: voterId(), proof }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    onSaved(d);
  }
  return (
    <section className="card memory-done" aria-live="polite">
      <b>{headline}</b>
      {children}
      {past ? <p className="small" style={{ margin: 0 }}>Archive days and practice puzzles don&apos;t go on the board.</p> : !saved ? (
        <div className="row zen-hide" style={{ alignItems: "end", justifyContent: "center" }}>
          <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
          <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my score</button>
        </div>
      ) : <p className="small" style={{ margin: 0 }}>Saved ✓</p>}
      <ShareResult title={title} date={date} score={score} replay={replay} />
    </section>
  );
}

/** Today's board, with each score shown the puzzle's own way */
export function TodayBoard({ board, show, note }: { board: DailyBoard | null; show: (ms: number) => string; note?: string }) {
  if (!board) return null;
  return (
    <section style={{ marginTop: "1.4rem" }}>
      <h2 className="h3" data-zen-board="">Today&apos;s best</h2>
      <Difficulty board={board} show={show} />
      {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{show(t.ms)}</b></li>)}</ol> : <p className="small muted">No scores yet today. Set the first one.</p>}
      {note && <p className="tiny muted">{note}</p>}
    </section>
  );
}

/** The usual daily-puzzle bookkeeping: the day, the saved state for that day, the timer and today's board */
export function useDaily<T>(game: string, key: string, fresh: (date: string) => T | null) {
  const [date, setDate] = useState("");
  const [state, setState] = useState<T | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [hints, setHints] = useState(0);
  const [board, setBoard] = useState<DailyBoard | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const d = playDay();
    setDate(d);
    let s: { date?: string; state?: T; start?: number; doneMs?: number; saved?: boolean; hints?: number } | null = null;
    try { s = JSON.parse(localStorage.getItem(dayKey(key)) ?? "null"); } catch {}
    if (s?.date === d && s.state) { setState(s.state); setStart(s.start ?? null); setDoneMs(s.doneMs ?? null); setSaved(!!s.saved); setHints(s.hints ?? 0); }
    else setState(fresh(d));
    setNow(Date.now()); setReady(true);
    fetch(`/api/daily-scores?game=${game}&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready || !date || rp.on) return;
    try { localStorage.setItem(dayKey(key), JSON.stringify({ date, state, start, doneMs, saved, hints })); } catch {}
  }, [ready, date, state, start, doneMs, saved, hints]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [start, doneMs]);
  const first = useMemo(() => (date ? fresh(date) : null), [date]); // eslint-disable-line react-hooks/exhaustive-deps
  const rp = useReplay<T>({ key: date ? dayKey(key) : key, date, state, setState, start, doneMs, first });
  const replay = rp.replay;
  /** Call on every move: starts the clock the first time */
  const tick = () => { const t = start ?? Date.now(); if (!start) { setStart(t); setNow(t); } return t; };
  const elapsed = doneMs ?? (start ? now - start : 0);
  return { date, state, setState, start, tick, elapsed, doneMs, setDoneMs, saved, setSaved, hints, setHints, board, setBoard, replay };
}
