"use client";
import "./page.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import ArchiveNote from "@/components/ArchiveNote";
import { DoneCard, TodayBoard, useDaily } from "@/components/DailyDone";
import { isPast } from "@/lib/archive";
import { GAME_MS, MAX_WORDS, judge, pack, startFor } from "@/lib/wordChain";
import { addFlag } from "@/lib/trophyFlags";

type S = { words: string[]; startedAt: number | null };

export default function WordChain() {
  const { toast } = useStore();
  const d = useDaily<S>("chain", "mm-chain", () => ({ words: [], startedAt: null }));
  const [guess, setGuess] = useState("");
  const [now, setNow] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const start = useMemo(() => (d.date ? startFor(d.date) : ""), [d.date]);
  const s = d.state, running = !!s?.startedAt && d.doneMs === null;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [running]);
  // Time's up
  useEffect(() => {
    if (!s?.startedAt || d.doneMs !== null) return;
    if (now - s.startedAt >= GAME_MS) { d.setDoneMs(GAME_MS); if (s.words.length >= 20) addFlag("chain-20"); toast(`Time! ${s.words.length} words ⛓️`); }
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s || !start) return <div className="page"><p className="muted">Linking the chain…</p></div>;
  const done = d.doneMs !== null, past = isPast(d.date), chain = [start, ...s.words], last = chain[chain.length - 1];
  const left = s.startedAt ? Math.max(0, GAME_MS - (Math.max(now, s.startedAt) - s.startedAt)) : GAME_MS;
  function begin() { d.tick(); d.setState({ ...s!, startedAt: Date.now() }); setNow(Date.now()); setTimeout(() => input.current?.focus(), 50); }
  function add() {
    if (!running) return;
    const r = judge(chain, guess);
    if ("why" in r) { toast(r.why); return; }
    d.setState({ ...s!, words: [...s!.words, guess.toLowerCase().trim()] }); setGuess("");
  }
  const letters = s.words.join("").length;
  return (
    <div className="page" style={{ maxWidth: "32rem" }}>
      <p className="eyebrow">a daily word game</p>
      <ArchiveNote date={d.date} path="/word-chain" />
      <h1 className="h2">Word <em>chain</em></h1>
      <p className="small muted">Two minutes. Starting from today&apos;s word, each word you type must begin with the last letter of the one before. Three to five letters, no repeats. How long a chain can you make?</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>Words <b>{s.words.length}</b></span><span className="mm-clock">⏱ <b>{Math.ceil(left / 1000)}</b>s</span></div>
      <p className="wc-chain" aria-live="polite">{chain.map((w, k) => <span key={k} className={k === 0 ? "start" : ""}>{w}</span>)}</p>
      {!s.startedAt ? <p className="center"><button className="btn btn-pink" onClick={begin}>▶ Start: the first word begins with {start[start.length - 1].toUpperCase()}</button></p>
        : !done && (
          <form className="row" style={{ justifyContent: "center", gap: "0.5rem" }} onSubmit={(e) => { e.preventDefault(); add(); }}>
            <label className="sr-only" htmlFor="wc-in">Next word, starting with {last[last.length - 1]}</label>
            <input ref={input} id="wc-in" className="input" style={{ maxWidth: "12rem", textTransform: "lowercase" }} autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={5} value={guess} onChange={(e) => setGuess(e.target.value)} placeholder={`${last[last.length - 1]}…`} />
            <button className="btn btn-pink btn-sm">Add</button>
          </form>
        )}
      {done && <DoneCard replay={d.replay} game="chain" title="Word chain" date={d.date} past={past} headline={`A chain of ${s.words.length} word${s.words.length === 1 ? "" : "s"} (${letters} letters) ⛓️`} score={pack(s.words.length, letters)} proof={s.words} saved={d.saved} onSaved={(b) => { d.setBoard(b); d.setSaved(true); }} />}
      {!past && <TodayBoard board={d.board} show={(v) => `${MAX_WORDS - Math.floor(v / 1_000_000)} words`} note="Most words wins; more letters breaks a tie." />}
    </div>
  );
}
