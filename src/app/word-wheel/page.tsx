"use client";
import "./page.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import ArchiveNote from "@/components/ArchiveNote";
import { DoneCard, TodayBoard, useDaily } from "@/components/DailyDone";
import { isPast } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { MAX_MAIN, judge, pack, rankOf, wheelFor } from "@/lib/wordWheel";
import { shuffled } from "@/lib/gameOrders";
import { addFlag } from "@/lib/trophyFlags";

type S = { main: string[]; bonus: string[] };

export default function WordWheel() {
  const { toast } = useStore();
  const d = useDaily<S>("wheel", "mm-wheel", () => ({ main: [], bonus: [] }));
  const [cur, setCurState] = useState<number[]>([]); // which wheel letters are in the word so far (8 = the centre)
  // Kept in a ref too, so quick typing never reads a stale word between renders
  const curRef = useRef<number[]>([]);
  const setCur = (v: number[]) => { curRef.current = v; setCurState(v); };
  const [spin, setSpin] = useState(0);
  const w = useMemo(() => (d.date ? wheelFor(d.date) : null), [d.date]);
  const ring = useMemo(() => (w ? (spin ? shuffled(w.ring, Math.random) : w.ring) : []), [w, spin]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || e.metaKey || e.ctrlKey || !w) return;
      const now = curRef.current;
      if (e.key === "Enter") { e.preventDefault(); enter(); }
      else if (e.key === "Backspace") { e.preventDefault(); setCur(now.slice(0, -1)); }
      else if (/^[a-z]$/i.test(e.key)) {
        const ch = e.key.toLowerCase();
        const k = ch === w.centre && !now.includes(8) ? 8 : ring.findIndex((l, i) => l === ch && !now.includes(i));
        if (k >= 0) setCur([...now, k]);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  if (!w || !d.state) return <div className="page"><p className="muted">Spinning the wheel…</p></div>;
  const s = d.state, done = d.doneMs !== null, past = isPast(d.date);
  const word = cur.map((k) => (k === 8 ? w.centre : ring[k])).join("");
  const typed = () => curRef.current.map((k) => (k === 8 ? w!.centre : ring[k])).join("");
  const total = w.main.length;
  function finish(main: string[]) {
    const t = d.tick();
    d.setDoneMs(Date.now() - t);
    if (main.length === total) addFlag("wheel-genius");
  }
  function enter() {
    const word = typed();
    if (done || !word) return;
    const r = judge(w!, [...s.main, ...s.bonus], word);
    setCur([]);
    if ("why" in r) return toast(r.why);
    d.tick();
    const next = r.ok === "main" ? { ...s, main: [...s.main, word] } : { ...s, bonus: [...s.bonus, word] };
    // Add to whatever's saved by now (two quick words in a row both count)
    d.setState((prev) => { const p = prev ?? s; return r.ok === "main" ? (p.main.includes(word) ? p : { ...p, main: [...p.main, word] }) : p.bonus.includes(word) ? p : { ...p, bonus: [...p.bonus, word] }; });
    toast(word === w!.word ? `${word.toUpperCase()}! The nine-letter word 🎉` : r.ok === "bonus" ? `${word.toUpperCase()}: a bonus word ✨` : `${word.toUpperCase()} ✓`);
    if (r.ok === "main" && next.main.length === total) { toast("Every word found: genius! 🧠🎉"); finish(next.main); }
  }
  const rank = rankOf(s.main.length, total);
  const pos = (k: number) => { const a = (k / 8) * Math.PI * 2 - Math.PI / 2; return { left: `${50 + 38 * Math.cos(a)}%`, top: `${50 + 38 * Math.sin(a)}%` }; };
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">a daily word game</p>
      <ArchiveNote date={d.date} path="/word-wheel" />
      <h1 className="h2">Word <em>wheel</em></h1>
      <p className="small muted">Make words of four letters or more from the wheel. Every word must use the middle letter, and each letter only once. There&apos;s one nine-letter word that uses them all. Rarer words count as bonus words. Stop whenever you like: your score is how many everyday words you found.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span><b>{rank}</b></span><span><b>{s.main.length}</b>/{total} words</span>{s.bonus.length > 0 && <span>✨ {s.bonus.length} bonus</span>}<span className="mm-clock">⏱ {clock(d.elapsed)}</span></div>
      <div className="ww-wheel" role="group" aria-label="Letter wheel">
        {ring.map((l, k) => <button key={`${spin}-${k}`} className={`ww-letter ${cur.includes(k) ? "used" : ""}`} style={pos(k)} onClick={() => !done && !cur.includes(k) && setCur([...cur, k])} disabled={done || cur.includes(k)} aria-label={l}>{l.toUpperCase()}</button>)}
        <button className={`ww-letter centre ${cur.includes(8) ? "used" : ""}`} onClick={() => !done && !cur.includes(8) && setCur([...cur, 8])} disabled={done || cur.includes(8)} aria-label={`${w.centre}, the middle letter`}>{w.centre.toUpperCase()}</button>
      </div>
      <p className="ww-word" aria-live="polite">{word.toUpperCase() || " "}</p>
      {!done && (
        <div className="row" style={{ justifyContent: "center", gap: "0.4rem", flexWrap: "wrap" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setCur(cur.slice(0, -1))} disabled={!cur.length}>⌫</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSpin(spin + 1)}>🔄 Shuffle</button>
          <button className="btn btn-pink btn-sm" onClick={enter} disabled={word.length < 4}>Enter</button>
          <button className="btn btn-ghost btn-sm" onClick={() => finish(s.main)} disabled={!s.main.length}>I&apos;m done for today</button>
        </div>
      )}
      <ul className="ww-found" aria-label="Words found">{[...s.main].sort().map((x) => <li key={x} className={x === w.word ? "nine" : ""}>{x}</li>)}{[...s.bonus].sort().map((x) => <li key={x} className="bonus">{x}</li>)}</ul>
      {done && (
        <>
          <p className="small"><b>Words you missed:</b> {w.main.filter((x) => !s.main.includes(x)).join(", ") || "none at all!"}</p>
          <DoneCard replay={d.replay} proof={s.main} game="wheel" title="Word wheel" date={d.date} past={past} headline={`${s.main.length} of ${total} words (${rank})${s.main.includes(w.word) ? ", nine-letter word found" : ""} 🎉`} score={pack(s.main.length, d.doneMs ?? 0)} saved={d.saved} onSaved={(b) => { d.setBoard(b); d.setSaved(true); }} />
        </>
      )}
      {!past && <TodayBoard board={d.board} show={(v) => `${MAX_MAIN - Math.floor(v / 1_000_000)} words · ${clock(v % 1_000_000)}`} note="Most words wins; time breaks a tie." />}
    </div>
  );
}
