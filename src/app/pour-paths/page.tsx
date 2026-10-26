"use client";
import "./page.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { gameSettings } from "@/lib/gameSettings";
import ShareResult from "@/components/ShareResult";
import ArchiveNote from "@/components/ArchiveNote";
import { dayKey, isPast, playDay } from "@/lib/archive";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { clock } from "@/lib/memory";
import { CUPS, PATH_MODES, extend, isSolved, pathsFor, type PathMode } from "@/lib/pourPaths";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-paths";
const COLOURS = ["#c8553d", "#e9a23b", "#2a9d8f", "#3d7dd8", "#8e5bb5", "#5a9e4b", "#e36aa5", "#8a5a3c"];
const LABEL: Record<PathMode, string> = { easy: "Easy 5×5", hard: "Hard 7×7" };

export default function PourPaths() {
  const { toast } = useStore();
  const [patterns, setPatterns] = useState(false);
  useEffect(() => { setPatterns(gameSettings().patterns); }, []);
  const [date, setDate] = useState("");
  const past = isPast(date);
  const [mode, setMode] = useState<PathMode>("easy");
  const [paths, setPaths] = useState<number[][]>([]);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const drawing = useRef<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => { setDate(playDay()); try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {} }, []);
  const puzzle = useMemo(() => (date ? pathsFor(date, mode) : null), [date, mode]);
  useEffect(() => {
    if (!puzzle) return;
    let s: { date?: string; paths?: number[][]; start?: number; doneMs?: number; saved?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(dayKey(`${KEY}-${mode}`)) ?? "null"); } catch {}
    const fresh = s?.date === date;
    setPaths(fresh && s!.paths?.length === puzzle.ends.length ? s!.paths! : puzzle.ends.map(() => []));
    setStart(fresh ? s!.start ?? null : null); setDoneMs(fresh ? s!.doneMs ?? null : null); setSaved(!!(fresh && s!.saved)); setNow(Date.now());
    fetch(`/api/daily-scores?game=paths&mode=${mode}&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, [puzzle, date, mode]);
  useEffect(() => { if (date && paths.length) try { localStorage.setItem(dayKey(`${KEY}-${mode}`), JSON.stringify({ date, paths, start, doneMs, saved })); } catch {} }, [date, mode, paths, start, doneMs, saved]);
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [start, doneMs]);
  // Finished the moment the last square fills
  useEffect(() => {
    if (!puzzle || doneMs !== null || !start || paths.length !== puzzle.ends.length) return;
    if (isSolved(puzzle.size, puzzle.ends, paths)) { setDoneMs(Date.now() - start); drawing.current = null; toast("Every cup's poured! 🎉"); }
  }, [paths, puzzle, start, doneMs, toast]);
  if (!puzzle || paths.length !== puzzle.ends.length) return <div className="page"><p className="muted">Lining up the cups…</p></div>;
  const { size, ends } = puzzle;

  function cellAt(e: React.PointerEvent) {
    const r = svg.current!.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * size), y = Math.floor(((e.clientY - r.top) / r.height) * size);
    return x >= 0 && y >= 0 && x < size && y < size ? y * size + x : null;
  }
  function begin(e: React.PointerEvent<SVGSVGElement>) {
    if (doneMs !== null) return;
    const cell = cellAt(e);
    if (cell === null) return;
    const cup = ends.findIndex((p) => p.includes(cell));
    const owner = cup >= 0 ? cup : paths.findIndex((p) => p.includes(cell));
    if (owner < 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = owner;
    if (!start) { const t = Date.now(); setStart(t); setNow(t); }
    // Starting on a cup begins a fresh pipe from it; starting on a pipe carries on from there
    setPaths(paths.map((p, i) => (i !== owner ? p : cup >= 0 ? [cell] : p.slice(0, p.indexOf(cell) + 1))));
  }
  function drag(e: React.PointerEvent) {
    const c = drawing.current, cell = cellAt(e);
    if (c === null || cell === null) return;
    setPaths((ps) => {
      // Fill in squares a quick swipe skipped over, one step at a time
      let out = ps;
      for (let guard = 0; guard < size * 2; guard++) {
        const last = out[c][out[c].length - 1];
        if (last === undefined || last === cell) break;
        const lx = last % size, ly = Math.floor(last / size), tx = cell % size, ty = Math.floor(cell / size);
        const step = lx !== tx ? last + Math.sign(tx - lx) : last + Math.sign(ty - ly) * size;
        const next = extend(size, ends, out, c, step);
        if (next === out) break;
        out = next;
      }
      return out;
    });
  }
  function end() { drawing.current = null; }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "paths", mode, ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  const filled = new Set(paths.flat()).size, joined = paths.filter((p, i) => p.length > 1 && ends[i].includes(p[0]) && ends[i].includes(p[p.length - 1])).length;
  const elapsed = doneMs ?? (start ? now - start : 0);
  const centre = (p: number) => [(p % size) + 0.5, Math.floor(p / size) + 0.5];
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={date} path="/pour-paths" />
      <h1 className="h2">Pour <em>paths</em></h1>
      <p className="small muted">Drag from a cup to its matching partner to lay a pipe. Join every pair and fill every square. Pipes can&apos;t cross; drawing over one cuts it back.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {(Object.keys(PATH_MODES) as PathMode[]).map((m) => <button key={m} className={`chip ${mode === m ? "on" : ""}`} aria-pressed={mode === m} onClick={() => setMode(m)}>{LABEL[m]}</button>)}
        <span className="memory-stats"><span>⏱ {clock(elapsed)}</span><span>{joined}/{ends.length} joined</span><span>{Math.round((filled / (size * size)) * 100)}%</span></span>
      </div>
      <svg ref={svg} className={`paths-board ${doneMs !== null ? "done" : ""}`} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Pour paths board, ${joined} of ${ends.length} pairs joined`}
        onPointerDown={begin} onPointerMove={drag} onPointerUp={end} onPointerCancel={end}>
        {[...Array(size * size).keys()].map((p) => <rect key={p} x={p % size + 0.03} y={Math.floor(p / size) + 0.03} width={0.94} height={0.94} rx={0.12} className="paths-cell" />)}
        {paths.map((p, i) => p.map((cell) => <rect key={`${i}-${cell}`} x={cell % size + 0.03} y={Math.floor(cell / size) + 0.03} width={0.94} height={0.94} rx={0.12} fill={COLOURS[i]} opacity={0.22} />))}
        {/* Colour-blind patterns: each path's squares carry its cup too */}
        {patterns && paths.map((p, i) => p.slice(1, -1).map((cell) => <text key={`m${i}-${cell}`} x={cell % size + 0.5} y={Math.floor(cell / size) + 0.55} fontSize={0.3} textAnchor="middle" dominantBaseline="middle" opacity={0.75}>{CUPS[i]}</text>))}
        {paths.map((p, i) => p.length > 1 && <polyline key={i} points={p.map((c) => centre(c).join(",")).join(" ")} fill="none" stroke={COLOURS[i]} strokeWidth={0.34} strokeLinecap="round" strokeLinejoin="round" />)}
        {ends.map((pair, i) => pair.map((cell) => {
          const [cx, cy] = centre(cell);
          return <g key={`${i}-${cell}`}><circle cx={cx} cy={cy} r={0.38} fill={COLOURS[i]} /><text x={cx} y={cy + 0.02} fontSize={0.42} textAnchor="middle" dominantBaseline="middle">{CUPS[i]}</text></g>;
        }))}
      </svg>
      {doneMs === null ? (
        <div className="row" style={{ justifyContent: "center" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPaths(ends.map(() => []))} disabled={!filled}>Clear the board</button>
        </div>
      ) : (
        <section className="card memory-done" aria-live="polite">
          <b>All poured in {clock(doneMs)} 🎉</b>
          {past ? <p className="small" style={{ margin: 0 }}>Archive days don&apos;t go on the board.</p> : !saved ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓ Your best today is {clock(board?.mine?.ms ?? doneMs)}.</p>}
          <p className="tiny muted" style={{ margin: 0 }}>New boards tomorrow{mode === "easy" ? ". Try the hard one?" : "."}</p>
          <ShareResult title="Pour paths" date={date} />
        </section>
      )}
      {board && !past && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">Today&apos;s quickest · {LABEL[mode]}</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{clock(t.ms)}</b></li>)}</ol> : <p className="small muted">No times yet today. Set the first one.</p>}
        </section>
      )}
    </div>
  );
}
