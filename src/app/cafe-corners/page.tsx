"use client";
import { useEffect, useMemo, useState } from "react";
import ShareResult from "@/components/ShareResult";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import ArchiveNote from "@/components/ArchiveNote";
import { dayKey, isPast, playDay } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { allUsed, canAdd, cornersFor, pack, problem, unpack, used } from "@/lib/letterBoxed";
import { addFlag } from "@/lib/trophyFlags";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-corners";
/** Where each letter sits round the square (0 to 100) */
const spot = (side: number, k: number): [number, number] => {
  const t = 20 + k * 30;
  return side === 0 ? [t, 0] : side === 1 ? [100, t] : side === 2 ? [t, 100] : [0, t];
};

export default function CafeCorners() {
  const { toast } = useStore();
  const [date, setDate] = useState("");
  const past = isPast(date);
  const [words, setWords] = useState<string[]>([]);
  const [cur, setCur] = useState("");
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const puzzle = useMemo(() => (date ? cornersFor(date) : null), [date]);
  useEffect(() => {
    const d = playDay();
    setDate(d);
    try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    let s: { date?: string; words?: string[]; cur?: string; start?: number; doneMs?: number; saved?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(dayKey(KEY)) ?? "null"); } catch {}
    if (s?.date === d) { setWords(s.words ?? []); setCur(s.cur ?? ""); setStart(s.start ?? null); setDoneMs(s.doneMs ?? null); setSaved(!!s.saved); }
    setNow(Date.now()); setLoaded(true);
    fetch(`/api/daily-scores?game=corners&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  useEffect(() => { if (date && loaded) try { localStorage.setItem(dayKey(KEY), JSON.stringify({ date, words, cur, start, doneMs, saved })); } catch {} }, [date, loaded, words, cur, start, doneMs, saved]);
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [start, doneMs]);
  const done = doneMs !== null;

  function add(ch: string) {
    if (done || !puzzle) return;
    if (!canAdd(puzzle.box, cur, ch)) { if (cur && puzzle.box.some((s) => s.includes(ch))) toast("Hop to a different side for the next letter."); return; }
    if (!start) { const t = Date.now(); setStart(t); setNow(t); }
    setCur(cur + ch);
  }
  function back() {
    if (done) return;
    // Rubbing out the first letter of a word takes you back into the word before
    if (cur.length <= 1 && words.length) { setCur(words[words.length - 1]); setWords(words.slice(0, -1)); }
    else setCur(cur.slice(0, -1));
  }
  function enter() {
    if (done || !puzzle) return;
    const why = problem(puzzle.box, words, cur);
    if (why) return toast(why);
    const next = [...words, cur];
    setWords(next); setCur(cur.slice(-1));
    if (allUsed(puzzle.box, next)) {
      setDoneMs(Date.now() - (start ?? Date.now())); setCur("");
      if (next.length <= puzzle.best.length) addFlag("corners-par");
      toast(next.length <= puzzle.best.length ? `Every letter in ${next.length} words: as good as the barista! 🔤✨` : `Every letter used, in ${next.length} words! 🎉`);
    }
  }
  function restart() { setWords([]); setCur(""); }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || e.metaKey || e.ctrlKey) return;
      if (e.key === "Enter") { e.preventDefault(); enter(); }
      else if (e.key === "Backspace") { e.preventDefault(); back(); }
      else if (/^[a-z]$/i.test(e.key)) add(e.key.toLowerCase());
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "corners", ms: pack(words.length, doneMs ?? 0), name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  if (!puzzle) return <div className="page"><p className="muted">Chalking up the letters…</p></div>;
  const { box, best } = puzzle;
  const u = used([...words, cur]);
  const where = (ch: string) => { const s = box.findIndex((x) => x.includes(ch)); return spot(s, box[s].indexOf(ch)); };
  const path = (w: string) => [...w].map((ch) => where(ch).join(",")).join(" ");
  const elapsed = doneMs ?? (start ? now - start : 0);
  const last = cur ? cur[cur.length - 1] : "";
  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">a daily word game</p>
      <ArchiveNote date={date} path="/cafe-corners" />
      <h1 className="h2">Café <em>corners</em></h1>
      <p className="small muted">Twelve letters are chalked round the square. Make words of 4 or more letters by hopping between sides: two letters from the same side can&apos;t come one after the other. Each new word starts with the last letter of the one before. Use every letter, in as few words as you can.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>Words <b>{words.length}</b></span><span>Letters <b>{box.join("").split("").filter((c) => u.has(c)).length}</b>/12</span><span>⏱ {clock(elapsed)}</span></div>
      <p className="lb-word" aria-live="polite">{cur ? cur.toUpperCase() : done ? "✓" : <span className="muted">Tap a letter</span>}</p>
      <div className={`lb-box ${done ? "done" : ""}`}>
        <svg viewBox="-8 -8 116 116" aria-hidden="true">
          <rect x="0" y="0" width="100" height="100" rx="4" className="lb-square" />
          {words.map((w, i) => <polyline key={i} points={path(w)} className="lb-done" />)}
          {cur.length > 1 && <polyline points={path(cur)} className="lb-cur" />}
        </svg>
        {box.flatMap((side, s) => [...side].map((ch, k) => {
          const [x, y] = spot(s, k);
          const ok = !done && canAdd(box, cur, ch);
          return (
            <button key={ch} className={`lb-letter ${u.has(ch) ? "used" : ""} ${ch === last ? "last" : ""}`} style={{ left: `${((x + 8) / 116) * 100}%`, top: `${((y + 8) / 116) * 100}%` }}
              onClick={() => add(ch)} aria-disabled={!ok} aria-label={`${ch.toUpperCase()}${u.has(ch) ? ", used" : ""}`}>{ch.toUpperCase()}</button>
          );
        }))}
      </div>
      <div className="row" style={{ gap: "0.5rem", justifyContent: "center", marginTop: "0.6rem" }}>
        <button className="btn btn-ghost btn-sm" onClick={back} disabled={done || (!cur && !words.length)}>⌫ Delete</button>
        <button className="btn btn-pink btn-sm" onClick={enter} disabled={done || cur.length < 2}>Enter</button>
        <button className="btn btn-ghost btn-sm" onClick={restart} disabled={done || !words.length}>Start over</button>
      </div>
      {words.length > 0 && <p className="center small" style={{ marginTop: "0.6rem" }}>{words.map((w) => w.toUpperCase()).join(" – ")}</p>}
      <p className="tiny muted center">You can type on a keyboard too: letters, Enter and backspace. The barista managed it in {best.length} words.</p>
      {done && (
        <section className="card memory-done" aria-live="polite">
          <b>Every letter in {words.length} words, {clock(doneMs)} 🎉</b>
          <p className="small" style={{ margin: 0 }}>The barista&apos;s go: {best.map((w) => w.toUpperCase()).join(" – ")}</p>
          {past ? <p className="small" style={{ margin: 0 }}>Archive days don&apos;t go on the board.</p> : !saved ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my score</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓</p>}
          <p className="tiny muted" style={{ margin: 0 }}>New letters tomorrow.</p>
          <ShareResult title="Café corners" date={date} />
        </section>
      )}
      {board && !past && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">Today&apos;s best</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => { const x = unpack(t.ms); return <li key={i}><span>{t.name}</span><b>{x.words} words · {clock(x.ms)}</b></li>; })}</ol> : <p className="small muted">No scores yet today. Set the first one.</p>}
          <p className="tiny muted">Fewest words wins; time breaks a tie.</p>
        </section>
      )}
    </div>
  );
}
