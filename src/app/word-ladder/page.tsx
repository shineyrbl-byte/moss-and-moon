"use client";
import "./page.css";
import { useEffect, useMemo, useRef, useState } from "react";
import ArchiveNote from "@/components/ArchiveNote";
import { dayKey, isPast, playDay } from "@/lib/archive";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { clock } from "@/lib/memory";
import { ladderFor, shortest, stepProblem } from "@/lib/wordLadder";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-ladder";

export default function WordLadder() {
  const { toast } = useStore();
  const [date, setDate] = useState("");
  const past = isPast(date);
  const [steps, setSteps] = useState<string[]>([]);
  const [word, setWord] = useState("");
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { setDate(playDay()); try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {} }, []);
  const lad = useMemo(() => (date ? ladderFor(date) : null), [date]);
  useEffect(() => {
    if (!lad) return;
    let s: { date?: string; steps?: string[]; start?: number; doneMs?: number; saved?: boolean; gaveUp?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(dayKey(KEY)) ?? "null"); } catch {}
    const fresh = s?.date === date;
    setSteps(fresh ? s!.steps ?? [] : []); setStart(fresh ? s!.start ?? null : null); setNow(Date.now());
    setDoneMs(fresh ? s!.doneMs ?? null : null); setSaved(!!(fresh && s!.saved)); setGaveUp(!!(fresh && s!.gaveUp));
    fetch(`/api/daily-scores?game=ladder&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, [lad, date]);
  useEffect(() => { if (date) try { localStorage.setItem(dayKey(KEY), JSON.stringify({ date, steps, start, doneMs, saved, gaveUp })); } catch {} }, [date, steps, start, doneMs, saved, gaveUp]);
  useEffect(() => {
    if (!start || doneMs !== null || gaveUp) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [start, doneMs, gaveUp]);

  if (!lad) return <div className="page"><p className="muted">Fetching the ladder…</p></div>;
  const last = steps[steps.length - 1] ?? lad.from, over = doneMs !== null || gaveUp;
  function add(e?: React.FormEvent) {
    e?.preventDefault();
    if (!lad || over) return;
    const w = word.trim().toLowerCase();
    const problem = stepProblem(last, w, [lad.from, ...steps]);
    if (problem) return toast(problem);
    const t = start ?? Date.now();
    if (!start) { setStart(t); setNow(t); }
    setSteps([...steps, w]); setWord("");
    if (w === lad.to) { setDoneMs(Date.now() - t); toast(steps.length + 1 <= lad.par ? "Perfect ladder! 🪜✨" : "You made it! 🎉"); }
    else input.current?.focus();
  }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "ladder", ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  async function share() {
    const text = `Word ladder ${date} 🪜\n${lad!.from.toUpperCase()} → ${lad!.to.toUpperCase()} in ${steps.length} steps (par ${lad!.par})${doneMs ? ` · ${clock(doneMs)}` : ""}`;
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast("Copied 📋"); } } catch {}
  }
  const changed = (a: string, b: string) => [...b].map((c, i) => c !== a[i]);
  const elapsed = doneMs ?? (start ? now - start : 0);
  const answer = gaveUp ? shortest(last, lad.to) : null;
  return (
    <div className="page" style={{ maxWidth: "32rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={date} path="/word-ladder" />
      <h1 className="h2">Word <em>ladder</em></h1>
      <p className="small muted">Turn <b>{lad.from.toUpperCase()}</b> into <b>{lad.to.toUpperCase()}</b> by changing one letter at a time. Every step has to be a real word. Our best is {lad.par} steps.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>⏱ {clock(elapsed)}</span><span>Steps <b>{steps.length}</b> · par {lad.par}</span></div>
      <ol className="ladder" aria-label="Your ladder">
        <li className="ladder-word end">{lad.from}</li>
        {steps.map((w, i) => (
          <li key={i} className={`ladder-word ${w === lad.to ? "end done" : ""}`}>
            {[...w].map((c, k) => <span key={k} className={changed(i ? steps[i - 1] : lad.from, w)[k] ? "new" : ""}>{c}</span>)}
          </li>
        ))}
        {!over && (
          <li>
            <form onSubmit={add} className="ladder-form">
              <input ref={input} className="input ladder-input" value={word} maxLength={4} autoCapitalize="none" autoComplete="off" autoCorrect="off" spellCheck={false} aria-label="Next word" placeholder="····" onChange={(e) => setWord(e.target.value.replace(/[^a-z]/gi, "").toLowerCase())} />
              <button className="btn btn-pink btn-sm" disabled={word.length !== 4}>Add</button>
            </form>
          </li>
        )}
        {!over && <li className="ladder-word goal" aria-label={`Goal: ${lad.to}`}>{lad.to}</li>}
      </ol>
      {!over && (
        <div className="row" style={{ justifyContent: "center", gap: "0.5rem" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setSteps(steps.slice(0, -1))} disabled={!steps.length}>↩ Undo a step</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setGaveUp(true)}>Show me a way</button>
        </div>
      )}
      {gaveUp && answer && <p className="small center">From {last.toUpperCase()}: {answer.map((w) => w.toUpperCase()).join(" → ")}</p>}
      {doneMs !== null && (
        <section className="card memory-done" aria-live="polite">
          <b>{steps.length <= lad.par ? `A perfect ${steps.length}-step ladder 🎉` : `Done in ${steps.length} steps 🎉`} · {clock(doneMs)}</b>
          {past ? <p className="small" style={{ margin: 0 }}>Archive days and practice puzzles don&apos;t go on the board.</p> : !saved ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓</p>}
          <button className="btn btn-ghost btn-sm" onClick={share}>Share</button>
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
