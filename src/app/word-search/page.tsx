"use client";
import "./page.css";
import { Difficulty, Ghost } from "@/components/GameExtras";
import { showDaily } from "@/lib/scoreFormat";
import { useEffect, useMemo, useRef, useState } from "react";
import ShareResult from "@/components/ShareResult";
import { useReplay } from "@/components/useReplay";
import ArchiveNote from "@/components/ArchiveNote";
import { dayKey, isPast, playDay } from "@/lib/archive";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { clock } from "@/lib/memory";
import { HIDDEN, lineBetween, SIZE, wordAt, wordSearchFor } from "@/lib/wordSearch";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-wordsearch";

export default function WordSearch() {
  const { toast } = useStore();
  const [date, setDate] = useState("");
  const past = isPast(date);
  const [found, setFound] = useState<string[]>([]);
  const [sel, setSel] = useState<{ a: number; b: number } | null>(null);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const dragging = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setDate(playDay()); }, []);
  const puzzle = useMemo(() => (date ? wordSearchFor(date) : null), [date]);
  useEffect(() => {
    if (!date) return;
    fetch(`/api/daily-scores?game=wordsearch&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
    try {
      setName(localStorage.getItem("mm-game-name") ?? "");
      const s = JSON.parse(localStorage.getItem(dayKey(KEY)) ?? "null");
      if (s?.date === date) { setFound(s.found ?? []); if (s.start) { setStart(s.start); setNow(Date.now()); } if (s.doneMs) setDoneMs(s.doneMs); if (s.saved) setSaved(true); }
    } catch {}
  }, [date]);
  useEffect(() => { if (!rp.on && date) try { localStorage.setItem(dayKey(KEY), JSON.stringify({ date, found, start, doneMs, saved })); } catch {} }, [date, found, start, doneMs, saved]);
  const rp = useReplay({ key: dayKey(KEY), date, state: found, setState: setFound, start, doneMs, first: null });
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [start, doneMs]);

  const line = sel ? lineBetween(sel.a, sel.b) ?? [sel.a] : [];
  const foundCells = useMemo(() => {
    const m = new Map<number, number>();
    puzzle?.words.forEach((w) => { const k = found.indexOf(w.word); if (k >= 0) w.cells.forEach((c) => m.set(c, k)); });
    return m;
  }, [puzzle, found]);

  function begin() { if (!start && doneMs === null) { const t = Date.now(); setStart(t); setNow(t); } }
  function check(a: number, b: number) {
    const cells = lineBetween(a, b);
    const w = cells && puzzle ? wordAt(puzzle.words, cells) : null;
    setSel(null); setAnchor(null);
    if (!w) return;
    if (found.includes(w)) return toast(`Already found ${w}`);
    const next = [...found, w];
    setFound(next);
    if (next.length === HIDDEN) setDoneMs(Date.now() - (start ?? Date.now()));
  }
  const cellAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const i = el?.dataset.i;
    return i === undefined ? null : Number(i);
  };
  function down(e: React.PointerEvent, i: number) {
    if (doneMs !== null) return;
    e.preventDefault();
    begin();
    if (anchor !== null && anchor !== i) return check(anchor, i);
    dragging.current = true;
    setSel({ a: i, b: i });
  }
  function move(e: React.PointerEvent) {
    if (!dragging.current) return;
    const i = cellAt(e.clientX, e.clientY);
    if (i !== null) setSel((s) => (s ? { ...s, b: i } : s));
  }
  function up() {
    if (!dragging.current || !sel) return;
    dragging.current = false;
    if (sel.a === sel.b) { setAnchor(sel.a); return; } // a tap: now tap the last letter
    check(sel.a, sel.b);
  }
  // Keyboard: Enter on the first letter, then on the last
  function key(i: number) {
    if (doneMs !== null) return;
    begin();
    if (anchor === null) { setAnchor(i); setSel({ a: i, b: i }); } else check(anchor, i);
  }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "wordsearch", ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  if (!puzzle) return <div className="page"><p className="muted">Hiding the words…</p></div>;
  const elapsed = doneMs ?? (start ? now - start : 0);
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={date} path="/word-search" />
      <h1 className="h2">Word <em>search</em></h1>
      <p className="small muted">Eight café words are hiding: across, down and diagonal. Drag across a word, or tap its first letter and then its last.</p>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <span className="small"><b>{found.length}</b> of {HIDDEN} found</span>
        <span className="memory-stats"><span className="mm-clock">⏱ {clock(elapsed)}</span></span>
      </div>
      <Ghost elapsed={elapsed} done={doneMs !== null} />
      <div ref={gridRef} className={`ws-grid ${doneMs !== null ? "done" : ""}`} style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }} onPointerMove={move} onPointerUp={up} onPointerLeave={() => { if (dragging.current) up(); }} role="grid" aria-label="Word search letters">
        {puzzle.grid.map((l, i) => {
          const f = foundCells.get(i);
          return (
            <button key={i} data-i={i} className={`ws-cell ${line.includes(i) ? "sel" : ""} ${anchor === i ? "anchor" : ""} ${f !== undefined ? `f${f % 4}` : ""}`}
              onPointerDown={(e) => down(e, i)} onClick={(e) => { if (e.detail === 0) key(i); }} aria-label={`${l}, row ${Math.floor(i / SIZE) + 1}, column ${(i % SIZE) + 1}`}>{l}</button>
          );
        })}
      </div>
      <ul className="ws-words" aria-label="Words to find">
        {puzzle.words.map((w) => <li key={w.word} className={found.includes(w.word) ? `got f${found.indexOf(w.word) % 4}` : ""}>{found.includes(w.word) ? "✓ " : ""}{w.word}</li>)}
      </ul>
      {doneMs !== null && (
        <section className="card memory-done" aria-live="polite">
          <b>All eight in {clock(doneMs)} 🎉</b>
          {past ? <p className="small" style={{ margin: 0 }}>Archive days and practice puzzles don&apos;t go on the board.</p> : !saved ? (
            <div className="row zen-hide" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓ Your best today is {clock(board?.mine?.ms ?? doneMs)}.</p>}
          <p className="tiny muted" style={{ margin: 0 }}>New words tomorrow.</p>
          <ShareResult title="Word search" date={date} score={doneMs} replay={rp.replay} />
        </section>
      )}
      {board && !past && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3" data-zen-board="">Today&apos;s quickest</h2>
          <Difficulty board={board} show={(v) => showDaily("wordsearch", v)} />
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{clock(t.ms)}</b></li>)}</ol> : <p className="small muted">No times yet today. Set the first one.</p>}
        </section>
      )}
    </div>
  );
}
