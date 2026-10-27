"use client";
import "./page.css";
import { Ghost } from "@/components/GameExtras";
import { useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import ArchiveNote from "@/components/ArchiveNote";
import { DoneCard, TodayBoard, useDaily } from "@/components/DailyDone";
import { isPast } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { HINT_MS, KIND_NAME, crypticFor, isRight, printed } from "@/lib/cryptic";
import { addFlag } from "@/lib/trophyFlags";

type S = { shown: number[]; kind: boolean; tries: number; gaveUp: boolean; solved: boolean };

export default function CrypticClue() {
  const { toast } = useStore();
  const d = useDaily<S>("cryptic", "mm-cryptic", () => ({ shown: [], kind: false, tries: 0, gaveUp: false, solved: false }));
  const [guess, setGuess] = useState("");
  const c = useMemo(() => (d.date ? crypticFor(d.date) : null), [d.date]);
  if (!c || !d.state) return <div className="page"><p className="muted">Sharpening the pencil…</p></div>;
  const s = d.state, done = d.doneMs !== null, over = done || s.gaveUp, past = isPast(d.date);
  const hintsUsed = s.shown.length + (s.kind ? 1 : 0);

  function check() {
    if (over) return;
    const clean = guess.toLowerCase().replace(/[^a-z]/g, "");
    if (clean.length !== c!.n) return toast(`It's ${c!.n} letters.`);
    const t = d.tick();
    if (isRight(clean, c!)) {
      d.setState({ ...s, tries: s.tries + 1, solved: true });
      d.setHints(hintsUsed);
      d.setDoneMs(Date.now() - t + hintsUsed * HINT_MS);
      if (!hintsUsed && s.tries === 0) addFlag("cryptic-first-go");
      toast("Got it! ✏️🎉");
    } else { d.setState({ ...s, tries: s.tries + 1 }); toast("Not quite. Have another look at the wordplay."); }
  }
  function reveal() {
    if (over) return;
    d.tick();
    const k = [...Array(c!.n).keys()].find((i) => !s.shown.includes(i));
    if (k === undefined) return;
    d.setState({ ...s, shown: [...s.shown, k] });
  }
  const boxes = [...Array(c.n).keys()].map((i) => (over ? c.a[i] : s.shown.includes(i) ? c.a[i] : guess.replace(/[^a-z]/gi, "")[i] ?? ""));
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={d.date} path="/cryptic-clue" />
      <h1 className="h2">Cryptic <em>clue</em></h1>
      <p className="small muted">One cryptic clue a day. Every clue has a plain definition at the start or the end, and wordplay for the rest: an anagram, a hidden word, two meanings, a sound-alike or bits joined up. The number is how many letters.</p>
      <blockquote className="cc-clue" aria-live="polite">{printed(c)}</blockquote>
      {s.kind && !over && <p className="small center">💡 It&apos;s {KIND_NAME[c.kind]}.</p>}
      <div className="cc-boxes" aria-hidden="true">{boxes.map((ch, i) => <span key={i} className={`cc-box ${s.shown.includes(i) && !done ? "shown" : ""} ${over ? "done" : ""}`}>{ch}</span>)}</div>
      {!over ? (
        <form className="row" style={{ gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }} onSubmit={(e) => { e.preventDefault(); check(); }}>
          <label className="sr-only" htmlFor="cc-guess">Your answer</label>
          <input id="cc-guess" className="input cc-input" autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={c.n + 4} value={guess} onChange={(e) => { setGuess(e.target.value); d.tick(); }} placeholder={`${c.n} letters`} />
          <button className="btn btn-pink btn-sm">Check</button>
        </form>
      ) : null}
      {!over && (
        <div className="row" style={{ gap: "0.4rem", justifyContent: "center", flexWrap: "wrap", marginTop: "0.6rem" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { d.tick(); d.setState({ ...s, kind: true }); }} disabled={s.kind}>What kind of clue? (+{HINT_MS / 1000}s)</button>
          <button className="btn btn-ghost btn-sm" onClick={reveal} disabled={s.shown.length >= c.n - 1}>Show a letter (+{HINT_MS / 1000}s)</button>
          <button className="btn btn-ghost btn-sm" onClick={() => d.setState({ ...s, gaveUp: true })}>Show me</button>
        </div>
      )}
      <p className="memory-stats center" style={{ display: "flex", justifyContent: "center" }}><span className="mm-clock">⏱ {clock(d.elapsed + (done ? 0 : hintsUsed * HINT_MS))}</span><span>Tries <b>{s.tries}</b></span></p>
      <Ghost elapsed={d.elapsed} done={d.doneMs !== null} />
      {over && (
        <section className="card cc-why">
          <p style={{ margin: 0 }}><b>{c.a.toUpperCase()}</b>: {c.why}</p>
          {s.gaveUp && !done && <p className="small muted" style={{ marginBottom: 0 }}>No score today, but there&apos;s a new clue tomorrow. Want more? Try a <a href="/practice">practice puzzle</a>.</p>}
        </section>
      )}
      {done && <DoneCard replay={d.replay} game="cryptic" title="Cryptic clue" date={d.date} past={past} headline={`Cracked in ${clock(d.doneMs ?? 0)}${hintsUsed ? ` (${hintsUsed} hint${hintsUsed === 1 ? "" : "s"})` : s.tries === 1 ? ", first go" : ""} 🎉`} score={d.doneMs!} saved={d.saved} onSaved={(b) => { d.setBoard(b); d.setSaved(true); }} />}
      {!past && <TodayBoard board={d.board} show={clock} />}
      <p className="tiny muted" style={{ marginTop: "1rem" }}>New to cryptics? Words like &ldquo;mixed&rdquo;, &ldquo;brewed&rdquo; or &ldquo;wildly&rdquo; mean shuffle the letters. &ldquo;Partly&rdquo; or &ldquo;found in&rdquo; mean the answer is hiding in the words. &ldquo;We hear&rdquo; means it sounds like something.</p>
    </div>
  );
}
