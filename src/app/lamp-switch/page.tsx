"use client";
import { useEffect, useMemo, useState } from "react";
import ShareResult from "@/components/ShareResult";
import { useReplay } from "@/components/useReplay";
import ArchiveNote from "@/components/ArchiveNote";
import { dayKey, isPast, playDay } from "@/lib/archive";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { clock } from "@/lib/memory";
import { HINT_MS, SIZE, allOff, lampsFor, press, solve } from "@/lib/lamps";
import { addFlag } from "@/lib/trophyFlags";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-lamps";

export default function LampSwitch() {
  const { toast } = useStore();
  const [date, setDate] = useState("");
  const past = isPast(date);
  const [presses, setPresses] = useState<number[]>([]);
  const [hint, setHint] = useState<number | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [extra, setExtra] = useState(0);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const d = playDay();
    setDate(d);
    try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    let s: { date?: string; presses?: number[]; start?: number; extra?: number; doneMs?: number; saved?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(dayKey(KEY)) ?? "null"); } catch {}
    if (s?.date === d) { setPresses(s.presses ?? []); setStart(s.start ?? null); setExtra(s.extra ?? 0); setDoneMs(s.doneMs ?? null); setSaved(!!s.saved); }
    setNow(Date.now());
    fetch(`/api/daily-scores?game=lamps&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  useEffect(() => { if (!rp.on && date) try { localStorage.setItem(dayKey(KEY), JSON.stringify({ date, presses, start, extra, doneMs, saved })); } catch {} }, [date, presses, start, extra, doneMs, saved]);
  const rp = useReplay({ key: dayKey(KEY), date, state: presses, setState: setPresses, start, doneMs, first: null });
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [start, doneMs]);
  const puzzle = useMemo(() => (date ? lampsFor(date) : null), [date]);
  const lit = useMemo(() => (puzzle ? presses.reduce((g, i) => press(g, i), puzzle.lit) : null), [puzzle, presses]);
  if (!puzzle || !lit) return <div className="page"><p className="muted">Wiring the lamps…</p></div>;
  const done = doneMs !== null;

  function tap(i: number) {
    if (done || !lit) return;
    const t = start ?? Date.now();
    if (!start) { setStart(t); setNow(t); }
    const next = [...presses, i];
    setPresses(next); setHint(null);
    if (allOff(press(lit, i))) { setDoneMs(Date.now() - t + extra); if (next.length <= puzzle!.fewest) addFlag("lamps-fewest"); toast("Lights out! Time for a nap 💤🎉"); }
  }
  function showHint() {
    const s = lit && solve(lit);
    if (s?.length) { setHint(s[0]); setExtra(extra + HINT_MS); }
  }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "lamps", ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  const elapsed = doneMs ?? (start ? now - start + extra : 0);
  const on = lit.filter(Boolean).length;
  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={date} path="/lamp-switch" />
      <h1 className="h2">Lamp <em>switch</em></h1>
      <p className="small muted">Closing time, and the lamps are all on the same muddled wiring. Tapping a lamp flips it and the lamps right next to it (above, below, left and right). Turn every lamp off.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={showHint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setPresses(presses.slice(0, -1)); setHint(null); }} disabled={!presses.length || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setPresses([]); setHint(null); }} disabled={!presses.length || done}>Start over</button>
      </div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>💡 <b>{on}</b> on</span><span>Taps <b>{presses.length}</b></span><span>⏱ {clock(elapsed)}</span></div>
      <div className={`lamps ${done ? "out" : ""}`} style={{ ["--n" as string]: SIZE }} role="grid" aria-label="Lamps">
        {lit.map((v, i) => (
          <button key={i} className={`lamp ${v ? "lit" : ""} ${hint === i ? "hint" : ""}`} onClick={() => tap(i)} disabled={done}
            aria-label={`Row ${Math.floor(i / SIZE) + 1}, lamp ${(i % SIZE) + 1}: ${v ? "on" : "off"}`} aria-pressed={v}>
            <span aria-hidden="true">{v ? "💡" : "○"}</span>
          </button>
        ))}
      </div>
      <p className="tiny muted center">It can be done in {puzzle.fewest} taps. Tapping a lamp twice undoes it, and the order doesn&apos;t matter.</p>
      {done && (
        <section className="card memory-done" aria-live="polite">
          <b>All off in {clock(doneMs)} with {presses.length} taps{presses.length === puzzle.fewest ? ", the fewest possible" : ""} 🎉</b>
          {past ? <p className="small" style={{ margin: 0 }}>Archive days and practice puzzles don&apos;t go on the board.</p> : !saved ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓</p>}
          <p className="tiny muted" style={{ margin: 0 }}>New wiring tomorrow.</p>
          <ShareResult title="Lamp switch" date={date} score={doneMs} replay={rp.replay} />
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
