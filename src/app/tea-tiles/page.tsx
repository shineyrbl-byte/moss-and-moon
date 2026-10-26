"use client";
import { useEffect, useMemo, useState } from "react";
import ShareResult from "@/components/ShareResult";
import ArchiveNote from "@/components/ArchiveNote";
import { dayKey, isPast, playDay } from "@/lib/archive";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { clock } from "@/lib/memory";
import { COLS, FACES, LAYOUT, ROWS, SHUFFLE_MS, freeSpots, hintPair, reshuffle, tilesFor, type Tile } from "@/lib/teaTiles";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-tiles";

export default function TeaTiles() {
  const { toast } = useStore();
  const [date, setDate] = useState("");
  const past = isPast(date);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [hint, setHint] = useState<number[]>([]);
  const [history, setHistory] = useState<Tile[][]>([]);
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
    let s: { date?: string; tiles?: Tile[]; start?: number; extra?: number; doneMs?: number; saved?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(dayKey(KEY)) ?? "null"); } catch {}
    const fresh = s?.date === d;
    setTiles(fresh && s!.tiles ? s!.tiles : tilesFor(d));
    setStart(fresh ? s!.start ?? null : null); setExtra(fresh ? s!.extra ?? 0 : 0); setDoneMs(fresh ? s!.doneMs ?? null : null); setSaved(!!(fresh && s!.saved)); setNow(Date.now());
    fetch(`/api/daily-scores?game=tiles&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  useEffect(() => { if (date && tiles.length + (doneMs !== null ? 1 : 0)) try { localStorage.setItem(dayKey(KEY), JSON.stringify({ date, tiles, start, extra, doneMs, saved })); } catch {} }, [date, tiles, start, extra, doneMs, saved]);
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [start, doneMs]);
  const free = useMemo(() => new Set((freeSpots(tiles) as Tile[]).map((t) => t.id)), [tiles]);
  const stuck = tiles.length > 0 && !hintPair(tiles);

  function tap(t: Tile) {
    if (doneMs !== null) return;
    if (!free.has(t.id)) { toast("That tile's blocked. Free tiles have nothing on top and an open side."); return; }
    if (!start) { const s = Date.now(); setStart(s); setNow(s); }
    setHint([]);
    if (picked === null || picked === t.id) { setPicked(picked === t.id ? null : t.id); return; }
    const other = tiles.find((x) => x.id === picked)!;
    if (other.face !== t.face) { setPicked(t.id); return; }
    const left = tiles.filter((x) => x.id !== t.id && x.id !== other.id);
    setHistory([...history, tiles]); setTiles(left); setPicked(null);
    if (!left.length) { const ms = Date.now() - (start ?? Date.now()) + extra; setDoneMs(ms); toast("The table's clear! 🫖🎉"); }
  }
  function shuffle() {
    setHistory([...history, tiles]);
    setTiles(reshuffle(tiles, Math.random)); setExtra(extra + SHUFFLE_MS); setPicked(null); setHint([]);
    toast(`Shuffled. That adds ${SHUFFLE_MS / 1000} seconds.`);
  }
  function showHint() {
    const p = hintPair(tiles);
    if (p) { setHint(p.map((t) => t.id)); setExtra(extra + 5000); }
  }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "tiles", ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  if (!date) return <div className="page"><p className="muted">Setting the table…</p></div>;
  const elapsed = doneMs ?? (start ? now - start + extra : 0);
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={date} path="/tea-tiles" />
      <h1 className="h2">Tea <em>tiles</em></h1>
      <p className="small muted">Tap two matching tiles to clear them. You can only take a tile with nothing on top of it and a free side on the left or right. Every day&apos;s table can be cleared.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={showHint} disabled={doneMs !== null || stuck}>Hint (+5s)</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setTiles(history[history.length - 1]); setHistory(history.slice(0, -1)); setPicked(null); }} disabled={!history.length || doneMs !== null}>↩ Undo</button>
        <span className="memory-stats"><span>⏱ {clock(elapsed)}</span><span>{tiles.length} left</span></span>
      </div>
      {stuck && doneMs === null && (
        <p className="small center" style={{ color: "var(--pink-ink)" }}>No pairs left to take. <button className="btn btn-pink btn-sm" onClick={shuffle}>Shuffle (+{SHUFFLE_MS / 1000}s)</button></p>
      )}
      {doneMs === null ? (
        <div className="tiles-wrap">
          <div className="tiles-board" style={{ ["--cols" as string]: COLS, ["--rows" as string]: ROWS }} role="group" aria-label="Tea tiles">
            {[...tiles].sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x).map((t) => (
              <button key={t.id} className={`tile ${free.has(t.id) ? "free" : ""} ${picked === t.id ? "picked" : ""} ${hint.includes(t.id) ? "hint" : ""}`}
                style={{ ["--x" as string]: t.x, ["--y" as string]: t.y, ["--z" as string]: t.z }} onClick={() => tap(t)}
                aria-label={`${FACES[t.face]}${free.has(t.id) ? "" : ", blocked"}`} aria-pressed={picked === t.id}>{FACES[t.face]}</button>
            ))}
          </div>
        </div>
      ) : (
        <section className="card memory-done" aria-live="polite">
          <b>Cleared in {clock(doneMs)} 🎉</b>
          {past ? <p className="small" style={{ margin: 0 }}>Archive days don&apos;t go on the board.</p> : !saved ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓</p>}
          <p className="tiny muted" style={{ margin: 0 }}>A new table tomorrow. {LAYOUT.length} tiles, {LAYOUT.length / 2} pairs.</p>
          <ShareResult title="Tea tiles" date={date} />
        </section>
      )}
      {board && !past && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">Today&apos;s quickest</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{clock(t.ms)}</b></li>)}</ol> : <p className="small muted">No times yet today. Set the first one.</p>}
          <p className="tiny muted">Hints add 5 seconds and shuffles add {SHUFFLE_MS / 1000}.</p>
        </section>
      )}
    </div>
  );
}
