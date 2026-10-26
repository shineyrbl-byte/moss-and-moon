"use client";
import "./page.css";
import { useEffect, useMemo, useState } from "react";
import { gameSettings } from "@/lib/gameSettings";
import ShareResult from "@/components/ShareResult";
import { useReplay } from "@/components/useReplay";
import ArchiveNote from "@/components/ArchiveNote";
import { dayKey, isPast, playDay } from "@/lib/archive";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { clock } from "@/lib/memory";
import { COLOURS, SIZE, flood, gridFor, isDone, packScore, par, region, unpackScore } from "@/lib/flood";
import { addFlag } from "@/lib/trophyFlags";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-flood";
const SYMS = "mm-flood-symbols";

export default function Flood() {
  const { toast } = useStore();
  const [date, setDate] = useState("");
  const past = isPast(date);
  const [picks, setPicks] = useState<number[]>([]);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [symbols, setSymbols] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const d = playDay();
    setDate(d);
    try { setName(localStorage.getItem("mm-game-name") ?? ""); const own = localStorage.getItem(SYMS); setSymbols(own === null ? gameSettings().patterns : own === "1"); } catch {}
    let s: { date?: string; picks?: number[]; start?: number; doneMs?: number; saved?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(dayKey(KEY)) ?? "null"); } catch {}
    if (s?.date === d) { setPicks(s.picks ?? []); setStart(s.start ?? null); setDoneMs(s.doneMs ?? null); setSaved(!!s.saved); }
    setNow(Date.now());
    fetch(`/api/daily-scores?game=flood&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  useEffect(() => { if (!rp.on && date) try { localStorage.setItem(dayKey(KEY), JSON.stringify({ date, picks, start, doneMs, saved })); } catch {} }, [date, picks, start, doneMs, saved]);
  const rp = useReplay({ key: dayKey(KEY), date, state: picks, setState: setPicks, start, doneMs, first: null });
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [start, doneMs]);
  const startGrid = useMemo(() => (date ? gridFor(date) : null), [date]);
  const target = useMemo(() => (startGrid ? par(startGrid) : 0), [startGrid]);
  const grid = useMemo(() => (startGrid ? picks.reduce((g, c) => flood(g, c), startGrid) : null), [startGrid, picks]);
  const owned = useMemo(() => (grid ? region(grid) : new Set<number>()), [grid]);
  if (!grid || !startGrid) return <div className="page"><p className="muted">Pouring the colours…</p></div>;

  const done = doneMs !== null;
  function pick(c: number) {
    if (done || !grid || c === grid[0]) return;
    const t = start ?? Date.now();
    if (!start) { setStart(t); setNow(t); }
    const next = [...picks, c];
    setPicks(next);
    if (isDone(flood(grid, c))) {
      setDoneMs(Date.now() - t);
      if (next.length < target) addFlag("flood-under-par");
      toast(next.length <= target ? `Filled in ${next.length} moves. Par beaten! 🎉` : `Filled in ${next.length} moves 🎨`);
    }
  }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "flood", ms: packScore(picks.length, doneMs ?? 0), name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  const elapsed = doneMs ?? (start ? now - start : 0);
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={date} path="/flood" />
      <h1 className="h2">Flood the <em>cup</em></h1>
      <p className="small muted">Your patch starts in the top-left corner. Pick a colour and your patch turns that colour, soaking up every square of it that touches. Fill the whole cup with one colour in as few moves as you can. Par is what our helper managed.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setPicks(picks.slice(0, -1))} disabled={!picks.length || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setPicks([])} disabled={!picks.length || done}>Start over</button>
        <label className="small row" style={{ gap: "0.3rem", alignItems: "center" }}><input type="checkbox" checked={symbols} onChange={(e) => { setSymbols(e.target.checked); try { localStorage.setItem(SYMS, e.target.checked ? "1" : "0"); } catch {} }} /> Symbols</label>
        <span className="memory-stats"><span>Moves <b>{picks.length}</b></span><span>Par <b>{target}</b></span><span>⏱ {clock(elapsed)}</span></span>
      </div>
      <div className={`flood-grid ${symbols ? "syms" : ""}`} style={{ ["--n" as string]: SIZE }} role="img" aria-label={`Your patch covers ${owned.size} of ${SIZE * SIZE} squares`}>
        {grid.map((c, i) => <span key={i} className={`flood-cell ${owned.has(i) ? "mine" : ""}`} style={{ background: COLOURS[c].hex }}>{symbols ? COLOURS[c].sym : ""}</span>)}
      </div>
      {!done && (
        <div className="flood-picks" role="group" aria-label="Colours">
          {COLOURS.map((c, i) => (
            <button key={i} className={`flood-pick ${grid[0] === i ? "now" : ""}`} onClick={() => pick(i)} disabled={grid[0] === i} aria-label={`${c.name}${grid[0] === i ? ", your colour now" : ""}`}>
              <span className="flood-swatch" style={{ background: c.hex }}>{c.sym}</span><span className="tiny">{c.name}</span>
            </button>
          ))}
        </div>
      )}
      <p className="tiny muted center">{owned.size} of {SIZE * SIZE} squares are yours.</p>
      {done && (
        <section className="card memory-done" aria-live="polite">
          <b>Filled in {picks.length} moves{picks.length < target ? `, ${target - picks.length} under par` : picks.length === target ? ", right on par" : ""} 🎉</b>
          {past ? <p className="small" style={{ margin: 0 }}>Archive days and practice puzzles don&apos;t go on the board.</p> : !saved ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my score</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓</p>}
          <p className="tiny muted" style={{ margin: 0 }}>A new cup tomorrow.</p>
          <ShareResult title="Flood the cup" date={date} score={packScore(picks.length, doneMs ?? 0)} replay={rp.replay} />
        </section>
      )}
      {board && !past && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">Today&apos;s best</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => { const u = unpackScore(t.ms); return <li key={i}><span>{t.name}</span><b>{u.moves} moves · {clock(u.ms)}</b></li>; })}</ol> : <p className="small muted">No scores yet today. Set the first one.</p>}
          <p className="tiny muted">Fewest moves wins. Ties go to the quickest.</p>
        </section>
      )}
    </div>
  );
}
