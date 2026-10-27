"use client";
import "./page.css";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import ArchiveNote from "@/components/ArchiveNote";
import { DoneCard, TodayBoard, useDaily } from "@/components/DailyDone";
import { isPast } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { HINT_MS, SIZE, clashes, codewordFor, isSolved } from "@/lib/codeword";
import { addFlag } from "@/lib/trophyFlags";

type S = Record<number, string>;
const ABC = "abcdefghijklmnopqrstuvwxyz".split("");

export default function Codeword() {
  const { toast } = useStore();
  const d = useDaily<S>("codeword", "mm-codeword", () => ({}));
  const [sel, setSel] = useState<number | null>(null);
  const c = useMemo(() => (d.date ? codewordFor(d.date) : null), [d.date]);
  const guess: S = useMemo(() => ({ ...(d.state ?? {}), ...(c ? Object.fromEntries(c.given.map((n) => [n, c.key[n]])) : {}) }), [d.state, c]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || e.metaKey || e.ctrlKey) return;
      if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); put(e.key.toLowerCase()); }
      else if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); put(""); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  if (!c || !d.state) return <div className="page"><p className="muted">Cracking the code…</p></div>;
  const done = d.doneMs !== null, past = isPast(d.date), bad = clashes(guess);
  const used = new Set(Object.values(guess).filter(Boolean));
  function put(letter: string) {
    if (sel === null || done || c!.given.includes(sel)) return;
    const t = d.tick();
    const next = { ...d.state!, [sel]: letter };
    d.setState(next);
    const full = { ...next, ...Object.fromEntries(c!.given.map((n) => [n, c!.key[n]])) };
    if (isSolved(c!, full)) { d.setDoneMs(Date.now() - t + d.hints * HINT_MS); if (!d.hints) addFlag("codeword-no-hints"); toast("Code cracked! 🔓🎉"); }
  }
  function hint() {
    // Fix a wrong letter, or else reveal the number you've picked (or the first one not right yet)
    const wrong = Object.entries(d.state!).find(([n, l]) => l && c!.key[+n] !== l);
    const n = wrong ? +wrong[0] : sel !== null && guess[sel] !== c!.key[sel] ? sel : Object.keys(c!.key).map(Number).find((k) => guess[k] !== c!.key[k]);
    if (n === undefined) return;
    const t = d.tick();
    const next = { ...d.state!, [n]: c!.key[n] }, h = d.hints + 1;
    d.setHints(h); d.setState(next); setSel(n);
    if (isSolved(c!, { ...next, ...Object.fromEntries(c!.given.map((k) => [k, c!.key[k]])) })) d.setDoneMs(Date.now() - t + h * HINT_MS);
  }
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">a daily word puzzle</p>
      <ArchiveNote date={d.date} path="/codeword" />
      <h1 className="h2">Code<em>word</em></h1>
      <p className="small muted">A criss-cross of café words where every letter has been swapped for a number: the same letter always gets the same number. Two letters are given. Tap a square, then a letter, and it fills in everywhere that number appears.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={hint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
        <span className="memory-stats"><span>⏱ {clock(d.elapsed + d.hints * HINT_MS)}</span><span><b>{Object.keys(c.key).filter((n) => guess[+n]).length}</b>/{c.n} letters</span></span>
      </div>
      <div className={`cw-grid ${done ? "done" : ""}`} style={{ ["--n" as string]: SIZE }} role="grid" aria-label="Codeword grid">
        {c.code.map((n, i) => n ? (
          <button key={i} className={`cw-cell ${sel === n ? "on" : ""} ${c.given.includes(n) ? "given" : ""} ${bad.has(n) ? "bad" : ""}`} onClick={() => setSel(n)}
            aria-label={`Number ${n}: ${guess[n] ? guess[n].toUpperCase() : "unknown"}${c.given.includes(n) ? ", given" : ""}`}>
            <span className="cw-n" aria-hidden="true">{n}</span><span aria-hidden="true">{guess[n]?.toUpperCase() ?? ""}</span>
          </button>
        ) : <span key={i} className="cw-cell blank" aria-hidden="true" />)}
      </div>
      {!done && (
        <>
          <p className="center small" aria-live="polite">{sel === null ? "Tap a square to pick its number." : c.given.includes(sel) ? `${sel} is given: ${c.key[sel].toUpperCase()}.` : `Number ${sel}: pick its letter.`}</p>
          <div className="cw-keys" role="group" aria-label="Letters">
            {ABC.map((l) => <button key={l} className={`cw-key ${used.has(l) ? "used" : ""}`} onClick={() => put(l)} disabled={sel === null || c.given.includes(sel)} aria-label={`${l}${used.has(l) ? ", already used" : ""}`}>{l.toUpperCase()}</button>)}
            <button className="cw-key wide" onClick={() => put("")} disabled={sel === null} aria-label="Clear">⌫</button>
          </div>
        </>
      )}
      {done && <DoneCard replay={d.replay} game="codeword" title="Codeword" date={d.date} past={past} headline={`Cracked in ${clock(d.doneMs ?? 0)}${d.hints ? ` (${d.hints} hint${d.hints === 1 ? "" : "s"})` : ", no hints"} 🎉`} score={d.doneMs!} saved={d.saved} onSaved={(b) => { d.setBoard(b); d.setSaved(true); }}><p className="small" style={{ margin: 0 }}>The words: {c.words.join(", ")}</p></DoneCard>}
      {!past && <TodayBoard board={d.board} show={clock} />}
    </div>
  );
}
