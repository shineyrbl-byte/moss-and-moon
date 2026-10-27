"use client";
import "./page.css";
import { useState } from "react";
import Link from "next/link";
import { LESSONS, lessonSolved, lessonWrong, type Lesson } from "@/lib/lessons";
import { addFlag } from "@/lib/trophyFlags";

const TREATS = ["", "☕", "🥐", "🍰", "🍵"];

function LessonBoard({ l, onSolved }: { l: Lesson; onSolved: () => void }) {
  const [a, setA] = useState<number[]>(l.kind === "path" ? [] : [...l.given]);
  const [tips, setTips] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const [solved, setSolved] = useState(false);
  const n = l.n, fixed = (i: number) => l.kind !== "path" && !!l.given[i];
  function update(next: number[]) {
    setA(next); setWrong([]);
    if (lessonSolved(l, next)) { setSolved(true); onSolved(); }
  }
  function tap(i: number) {
    if (solved || fixed(i)) return;
    if (l.kind === "path") {
      // Start on 1, step to touching squares, tap a square on the line to go back to it
      const k = a.indexOf(i);
      if (k >= 0) return update(a.slice(0, k + 1));
      if (!a.length) { if (l.marks![i] === 1) update([i]); return; }
      const last = a[a.length - 1], touches = Math.abs(Math.floor(last / n) - Math.floor(i / n)) + Math.abs((last % n) - (i % n)) === 1;
      if (touches) update([...a, i]);
      return;
    }
    const cycle = l.kind === "values" ? [0, 1, 2, 3, 4] : l.kind === "stars" ? [0, 2] : [0, 2, 1];
    const next = [...a]; next[i] = cycle[(cycle.indexOf(a[i]) + 1) % cycle.length];
    update(next);
  }
  const border = (i: number) => {
    if (!l.regions) return "";
    const r = l.regions, right = i % n < n - 1 && r[i + 1] !== r[i], down = i < n * (n - 1) && r[i + n] !== r[i];
    return `${right ? "br" : ""} ${down ? "bd" : ""}`;
  };
  const counts = l.kind === "bikes";
  return (
    <div className="ln-lesson">
      <p className="small">{l.intro}</p>
      <div className="ln-board" style={{ ["--n" as string]: n + (counts ? 1 : 0) }} role="grid" aria-label={`${l.title} lesson`}>
        {counts && <span />}
        {counts && l.cols!.map((c, k) => <span key={`c${k}`} className="ln-count">{c}</span>)}
        {[...Array(n * n).keys()].map((i) => {
          const v = a[i], step = l.kind === "path" ? a.indexOf(i) : -1;
          const cell = (
            <button key={i} className={`ln-cell ${fixed(i) ? "given" : ""} ${wrong.includes(i) ? "wrong" : ""} ${border(i)} ${l.kind === "path" && step >= 0 ? "on" : ""} ${l.kind === "bikes" && v === 2 ? "bike" : ""}`} onClick={() => tap(i)}
              aria-label={`Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}`}>
              {l.kind === "values" ? TREATS[v] : l.kind === "stars" ? (v === 2 ? "⭐" : "") : l.kind === "bikes" ? (v === 2 ? "🚲" : v === 1 ? "·" : "") : <>{l.marks![i] ? <b className="ln-num">{l.marks![i]}</b> : null}{step >= 0 && !l.marks![i] ? <i className="ln-dot">{step + 1}</i> : null}</>}
            </button>
          );
          return counts && i % n === 0 ? [<span key={`r${i}`} className="ln-count">{l.rows![i / n]}</span>, cell] : cell;
        })}
      </div>
      {l.kind === "values" && <p className="tiny muted center">Tap a square to cycle through the treats.</p>}
      {l.kind === "bikes" && <p className="tiny muted center">Tap once for bike, twice for road.</p>}
      <ol className="ln-tips">{l.tips.slice(0, tips).map((t, k) => <li key={k}>{t}</li>)}</ol>
      {solved ? (
        <p className="ln-done" role="status">🎉 That&apos;s it! <Link href={l.href}>Try today&apos;s {l.title} →</Link></p>
      ) : (
        <div className="row" style={{ gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
          {tips < l.tips.length && <button className="btn btn-ghost btn-sm" onClick={() => setTips(tips + 1)}>💡 {tips ? "Another tip" : "A tip, please"}</button>}
          {l.kind !== "path" && <button className="btn btn-ghost btn-sm" onClick={() => setWrong(lessonWrong(l, a))}>Check</button>}
          <button className="btn btn-ghost btn-sm" onClick={() => { setA(l.kind === "path" ? [] : [...l.given]); setWrong([]); }}>Start over</button>
        </div>
      )}
      {wrong.length > 0 && <p className="tiny center" role="status">{wrong.length} square{wrong.length === 1 ? "" : "s"} not right yet (in red).</p>}
    </div>
  );
}

export default function Learn() {
  const [open, setOpen] = useState(LESSONS[0].id);
  const [done, setDone] = useState<string[]>([]);
  function solved(id: string) { const d = [...new Set([...done, id])]; setDone(d); if (d.length === LESSONS.length) addFlag("learn-all"); }
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">the games</p>
      <h1 className="h2">Learn to <em>play</em></h1>
      <p className="small muted">Never tried a logic puzzle? Each of these is a tiny version of one of our daily puzzles, with tips you can reveal one at a time. Solve it and you&apos;re ready for the real thing.</p>
      <div className="ln-tabs" role="tablist">
        {LESSONS.map((l) => <button key={l.id} role="tab" aria-selected={open === l.id} className={`chip ${open === l.id ? "on" : ""}`} onClick={() => setOpen(l.id)}>{done.includes(l.id) ? "✓ " : ""}{l.title}</button>)}
      </div>
      {LESSONS.filter((l) => l.id === open).map((l) => <LessonBoard key={l.id} l={l} onSolved={() => solved(l.id)} />)}
    </div>
  );
}
