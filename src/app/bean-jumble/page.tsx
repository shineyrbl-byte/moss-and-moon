"use client";
import { useEffect, useMemo, useState } from "react";
import ArchiveNote from "@/components/ArchiveNote";
import { dayKey, isPast, playDay } from "@/lib/archive";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { clock } from "@/lib/memory";
import { SKIP_MS, isAnswer, jumbleFor } from "@/lib/jumble";
import { addFlag } from "@/lib/trophyFlags";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-jumble";

export default function BeanJumble() {
  const { toast } = useStore();
  const [date, setDate] = useState("");
  const past = isPast(date);
  const [at, setAt] = useState(0);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [picked, setPicked] = useState<number[]>([]); // indexes into the shown letters
  const [order, setOrder] = useState<number[]>([]);
  const [start, setStart] = useState<number | null>(null);
  const [extra, setExtra] = useState(0);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [reveal, setReveal] = useState<string | null>(null);
  const [wrong, setWrong] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const words = useMemo(() => (date ? jumbleFor(date) : []), [date]);
  useEffect(() => {
    const d = playDay();
    setDate(d);
    try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    let s: { date?: string; at?: number; skipped?: number[]; start?: number; extra?: number; doneMs?: number; saved?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(dayKey(KEY)) ?? "null"); } catch {}
    if (s?.date === d) { setAt(s.at ?? 0); setSkipped(s.skipped ?? []); setStart(s.start ?? null); setExtra(s.extra ?? 0); setDoneMs(s.doneMs ?? null); setSaved(!!s.saved); }
    setNow(Date.now());
    fetch(`/api/daily-scores?game=jumble&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  useEffect(() => { if (date) try { localStorage.setItem(dayKey(KEY), JSON.stringify({ date, at, skipped, start, extra, doneMs, saved })); } catch {} }, [date, at, skipped, start, extra, doneMs, saved]);
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [start, doneMs]);
  const cur = words[at];
  useEffect(() => { if (cur) { setOrder([...cur.letters].map((_, i) => i)); setPicked([]); } }, [cur]);

  function next(skip: boolean) {
    if (!cur || start === null) return;
    const sk = skip ? [...skipped, at] : skipped, ex = skip ? extra + SKIP_MS : extra;
    setSkipped(sk); setExtra(ex);
    if (at === words.length - 1) {
      setDoneMs(Date.now() - start + ex);
      if (!sk.length) addFlag("jumble-no-skips");
      toast(sk.length ? "All five done! ☕" : "All five, no skips! 🔀🎉");
    }
    setAt(at + 1);
  }
  function add(i: number) {
    if (!cur || reveal || picked.includes(i)) return;
    const p = [...picked, i];
    setPicked(p);
    if (p.length === cur.letters.length) {
      const guess = p.map((k) => cur.letters[k]).join("");
      if (isAnswer(guess, cur.word)) { setTimeout(() => next(false), 250); }
      else { setWrong(true); setTimeout(() => { setWrong(false); setPicked([]); }, 600); }
    }
  }
  function skip() {
    if (!cur || reveal) return;
    setReveal(cur.word);
    setTimeout(() => { setReveal(null); next(true); }, 1300);
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!cur || start === null || doneMs !== null || (e.target as HTMLElement).tagName === "INPUT" || e.metaKey || e.ctrlKey) return;
      if (e.key === "Backspace") { e.preventDefault(); setPicked(picked.slice(0, -1)); return; }
      const k = e.key.toLowerCase();
      if (k.length !== 1) return;
      const i = order.find((o) => cur.letters[o] === k && !picked.includes(o));
      if (i !== undefined) { e.preventDefault(); add(i); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "jumble", ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  if (!words.length) return <div className="page"><p className="muted">Shaking the jar…</p></div>;
  const done = doneMs !== null;
  const elapsed = doneMs ?? (start ? now - start + extra : 0);
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={date} path="/bean-jumble" />
      <h1 className="h2">Bean <em>jumble</em></h1>
      <p className="small muted">Five café words with their letters mixed up, from five letters long to nine. Tap the letters (or type) to spell each one out. Stuck? Skipping shows you the word but adds {SKIP_MS / 1000} seconds.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}>
        <span>Word <b>{Math.min(at + 1, words.length)}</b>/{words.length}</span><span>⏱ {clock(elapsed)}</span>
      </div>
      <ol className="jb-steps" aria-label="Progress">
        {words.map((w, i) => <li key={i} className={i < at ? (skipped.includes(i) ? "skip" : "ok") : i === at && !done ? "now" : ""}>{i < at ? (skipped.includes(i) ? "⏭" : "✓") : w.word.length}</li>)}
      </ol>
      {start === null ? (
        <p className="center" style={{ margin: "2rem 0" }}><button className="btn btn-pink" onClick={() => { const t = Date.now(); setStart(t); setNow(t); }}>▶ Start the clock</button></p>
      ) : !done && cur ? (
        <section className="jb-play">
          <div className={`jb-answer ${wrong ? "wrong" : ""}`} aria-live="polite" aria-label="Your answer">
            {reveal ? [...reveal].map((c, i) => <span key={i} className="jb-slot shown">{c}</span>)
              : [...cur.letters].map((_, i) => (
                <button key={i} className={`jb-slot ${picked[i] !== undefined ? "full" : ""}`} onClick={() => setPicked(picked.slice(0, i))} disabled={picked[i] === undefined} aria-label={picked[i] !== undefined ? `Remove ${cur.letters[picked[i]]}` : "Empty"}>
                  {picked[i] !== undefined ? cur.letters[picked[i]] : ""}
                </button>
              ))}
          </div>
          <div className="jb-letters" role="group" aria-label="Letters">
            {order.map((i) => <button key={i} className="jb-tile" onClick={() => add(i)} disabled={picked.includes(i) || !!reveal}>{cur.letters[i]}</button>)}
          </div>
          <div className="row" style={{ justifyContent: "center", gap: "0.5rem" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setOrder([...order].sort(() => Math.random() - 0.5))}>🔀 Mix</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setPicked([])} disabled={!picked.length}>Clear</button>
            <button className="btn btn-ghost btn-sm" onClick={skip} disabled={!!reveal}>Skip (+{SKIP_MS / 1000}s)</button>
          </div>
        </section>
      ) : null}
      {done && (
        <section className="card memory-done" aria-live="polite">
          <b>All five in {clock(doneMs)}{skipped.length ? ` (${skipped.length} skipped)` : ""} 🎉</b>
          <p className="small" style={{ margin: 0 }}>{words.map((w, i) => <span key={i}>{i ? " · " : ""}{skipped.includes(i) ? <s>{w.word}</s> : w.word}</span>)}</p>
          {past ? <p className="small" style={{ margin: 0 }}>Archive days don&apos;t go on the board.</p> : !saved ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓</p>}
          <p className="tiny muted" style={{ margin: 0 }}>Five new words tomorrow.</p>
        </section>
      )}
      {board && !past && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">Today&apos;s quickest</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{clock(t.ms)}</b></li>)}</ol> : <p className="small muted">No times yet today. Set the first one.</p>}
        </section>
      )}
    </div>
  );
}
