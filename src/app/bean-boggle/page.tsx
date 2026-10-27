"use client";
import "./page.css";
import { Difficulty } from "@/components/GameExtras";
import { showDaily } from "@/lib/scoreFormat";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import ArchiveNote from "@/components/ArchiveNote";
import ShareResult from "@/components/ShareResult";
import { useReplay } from "@/components/useReplay";
import { dayKey, isPast, playDay } from "@/lib/archive";
import { N, SECONDS, fromBoard, pathFor, points, problem, toBoard, total, touching, trayFor } from "@/lib/boggle";
import { addFlag } from "@/lib/trophyFlags";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-boggle";

export default function BeanBoggle() {
  const { toast } = useStore();
  const [date, setDate] = useState("");
  const past = isPast(date);
  const [found, setFound] = useState<string[]>([]);
  const [path, setPath] = useState<number[]>([]);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const dragging = useRef(false), moved = useRef(false);
  const tray = useMemo(() => (date ? trayFor(date) : null), [date]);
  useEffect(() => {
    const d = playDay();
    setDate(d);
    try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    let s: { date?: string; found?: string[]; start?: number; doneMs?: number; saved?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(dayKey(KEY)) ?? "null"); } catch {}
    if (s?.date === d) { setFound(s.found ?? []); setStart(s.start ?? null); setDoneMs(s.doneMs ?? null); setSaved(!!s.saved); }
    setNow(Date.now()); setLoaded(true);
    fetch(`/api/daily-scores?game=boggle&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  useEffect(() => { if (!rp.on && date && loaded) try { localStorage.setItem(dayKey(KEY), JSON.stringify({ date, found, start, doneMs, saved })); } catch {} }, [date, loaded, found, start, doneMs, saved]);
  const rp = useReplay({ key: dayKey(KEY), date, state: found, setState: setFound, start, doneMs, first: null });
  const left = start ? Math.max(0, SECONDS * 1000 - (now - start)) : SECONDS * 1000;
  const done = doneMs !== null;
  useEffect(() => {
    if (!start || done) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [start, done]);
  // Time's up
  useEffect(() => {
    if (!start || done || left > 0) return;
    setDoneMs(SECONDS * 1000); setPath([]);
    const sc = total(found);
    if (sc >= 30) addFlag("boggle-30");
    toast(`Time's up! ${found.length} word${found.length === 1 ? "" : "s"}, ${sc} point${sc === 1 ? "" : "s"} 🔠`);
  }, [left, start, done]); // eslint-disable-line react-hooks/exhaustive-deps

  const grid = tray?.grid ?? [];
  const word = path.map((i) => grid[i]).join("");
  function begin() { const t = Date.now(); setStart(t); setNow(t); }
  /** Pressing a cube: tap the last letter again to send the word, an earlier one to go back to it, or a new one to add it */
  function press(i: number) {
    if (!start || done) return;
    setTyped("");
    const at = path.indexOf(i);
    if (at === path.length - 1 && path.length) return send();
    if (at >= 0) { setPath(path.slice(0, at + 1)); return; }
    if (path.length && !touching(path[path.length - 1], i)) { setPath([i]); return; }
    setPath([...path, i]);
  }
  /** Dragging onto a cube: add it if it touches the last one, or step back if it's the one before */
  function drag(i: number) {
    if (!dragging.current || !start || done) return;
    if (path.length > 1 && path[path.length - 2] === i) { setPath(path.slice(0, -1)); moved.current = true; return; }
    if (!path.includes(i) && path.length && touching(path[path.length - 1], i)) { setPath([...path, i]); moved.current = true; }
  }
  function send(w = word) {
    if (!tray || !w) return;
    const why = problem(grid, found, w);
    setPath([]);
    if (why) return toast(why);
    setFound([w, ...found]);
    toast(`${w.toUpperCase()} +${points(w)}${points(w) >= 3 ? " ✨" : ""}`);
  }
  // Typing: letters build the word (following the tray), Enter sends it
  const [typed, setTyped] = useState("");
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || e.metaKey || e.ctrlKey || !start || done) return;
      if (e.key === "Enter") { e.preventDefault(); if (typed) { send(typed); setTyped(""); } else send(); }
      else if (e.key === "Backspace") { e.preventDefault(); if (typed) setTyped(typed.slice(0, -1)); else setPath(path.slice(0, -1)); }
      else if (e.key === "Escape") { setTyped(""); setPath([]); }
      else if (/^[a-z]$/i.test(e.key)) { const t = typed + e.key.toLowerCase(); setTyped(t); setPath(pathFor(grid, t) ?? []); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "boggle", ms: toBoard(total(found)), name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  if (!tray) return <div className="page"><p className="muted">Shaking the letter cubes…</p></div>;
  const score = total(found);
  const shown = typed || word;
  const missed = tray.everyday.filter((w) => !found.includes(w));
  return (
    <div className="page" style={{ maxWidth: "32rem" }}>
      <p className="eyebrow">a daily word game</p>
      <ArchiveNote date={date} path="/bean-boggle" />
      <h1 className="h2">Bean <em>boggle</em></h1>
      <p className="small muted">You have three minutes to find words in the tray of letters. Join letters that touch (across, down or corner to corner), using each cube only once in a word. Words need 4 or more letters, and longer ones score more: 4 letters 1 point, 5 letters 2, 6 letters 3, 7 letters 5, and 8 or more 11.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}>
        <span>⏱ <b>{Math.floor(Math.ceil(left / 1000) / 60)}:{String(Math.ceil(left / 1000) % 60).padStart(2, "0")}</b></span><span>Words <b>{found.length}</b></span><span>Points <b>{score}</b></span>
      </div>
      <p className="lb-word" aria-live="polite">{shown ? shown.toUpperCase() : <span className="muted">{start && !done ? "Tap or drag across the letters" : " "}</span>}</p>
      <div className={`bo-wrap ${!start ? "hidden" : ""}`}>
        <div className={`bo-grid ${done ? "done" : ""}`} style={{ ["--n" as string]: N }} role="grid" aria-label="Letter tray"
          onPointerUp={() => { const sendIt = dragging.current && moved.current && path.length > 1; dragging.current = false; moved.current = false; if (sendIt) send(); }}
          onPointerLeave={() => { dragging.current = false; moved.current = false; }}>
          {grid.map((f, i) => (
            <button key={i} className={`bo-cube ${path.includes(i) ? "on" : ""} ${path[path.length - 1] === i ? "last" : ""}`} disabled={!start || done}
              onPointerDown={(e) => { (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); dragging.current = true; moved.current = false; press(i); }}
              onPointerEnter={() => drag(i)}
              onClick={(e) => { if (e.detail === 0) press(i); }}
              aria-label={`${f.toUpperCase()}${path.includes(i) ? ", in your word" : ""}`}>{f === "qu" ? "Qu" : f.toUpperCase()}</button>
          ))}
        </div>
        {!start && <div className="bb-over"><button className="btn btn-pink" onClick={begin}>▶ Start the three minutes</button></div>}
      </div>
      {start && !done && (
        <div className="row" style={{ justifyContent: "center", gap: "0.5rem", marginTop: "0.6rem" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { setPath([]); setTyped(""); }} disabled={!shown}>Clear</button>
          <button className="btn btn-pink btn-sm" onClick={() => { send(typed || word); setTyped(""); }} disabled={!shown}>Enter</button>
        </div>
      )}
      <p className="tiny muted center">Drag across the letters and let go to send a word, or tap them one by one and tap the last again (or press Enter). You can type too.</p>
      {found.length > 0 && <p className="bo-found small">{found.map((w) => <span key={w}>{w}<sup>{points(w)}</sup></span>)}</p>}
      {done && (
        <section className="card memory-done" aria-live="polite">
          <b>{found.length} word{found.length === 1 ? "" : "s"}, {score} point{score === 1 ? "" : "s"} 🎉</b>
          {missed.length > 0 && <p className="small" style={{ margin: 0 }}>Some everyday ones you missed: {missed.slice(0, 18).join(", ")}{missed.length > 18 ? `, and ${missed.length - 18} more` : ""}.</p>}
          {past ? <p className="small" style={{ margin: 0 }}>Archive days and practice puzzles don&apos;t go on the board.</p> : !saved && score > 0 ? (
            <div className="row zen-hide" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my score</button>
            </div>
          ) : saved ? <p className="small" style={{ margin: 0 }}>Saved ✓</p> : null}
          <p className="tiny muted" style={{ margin: 0 }}>A new tray tomorrow.</p>
          <ShareResult title="Bean boggle" date={date} score={toBoard(total(found))} replay={rp.replay} />
        </section>
      )}
      {board && !past && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3" data-zen-board="">Today&apos;s best</h2>
          <Difficulty board={board} show={(v) => showDaily("boggle", v)} />
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{fromBoard(t.ms)} points</b></li>)}</ol> : <p className="small muted">No scores yet today. Set the first one.</p>}
          <p className="tiny muted">Everyone gets the same tray today, and three minutes each.</p>
        </section>
      )}
    </div>
  );
}
