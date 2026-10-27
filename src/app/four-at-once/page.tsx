"use client";
import "./page.css";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import ArchiveNote from "@/components/ArchiveNote";
import { DoneCard, TodayBoard, useDaily } from "@/components/DailyDone";
import { isPast } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { TRIES, allSolved, fourFor, isGuess, isOver, keyMarks, pack, score, solvedAt, type Mark } from "@/lib/quordle";
import { addFlag } from "@/lib/trophyFlags";

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const unpack = (v: number) => ({ n: Math.floor(v / 1_000_000), ms: v % 1_000_000 });

export default function FourAtOnce() {
  const { toast } = useStore();
  const d = useDaily<string[]>("four", "mm-four", () => []);
  const [cur, setCur] = useState("");
  const words = useMemo(() => (d.date ? fourFor(d.date) : null), [d.date]);
  const guesses = d.state ?? [];
  const over = !!words && isOver(words, guesses), won = !!words && allSolved(words, guesses);
  function type(ch: string) { if (!over && cur.length < 5) setCur(cur + ch); }
  function back() { setCur(cur.slice(0, -1)); }
  function enter() {
    if (!words || over) return;
    if (cur.length < 5) return toast("Five letters, please.");
    if (!isGuess(cur)) return toast("That's not in our word list.");
    if (guesses.includes(cur)) return toast("You've tried that one.");
    const t = d.tick();
    const next = [...guesses, cur];
    d.setState(next); setCur("");
    if (allSolved(words, next)) {
      d.setDoneMs(Date.now() - t);
      if (next.length <= 6) addFlag("four-six");
      toast(`All four in ${next.length}! 🍀🎉`);
    } else if (next.length >= TRIES) { d.setDoneMs(Date.now() - t); toast(`Out of tries. They were ${words.map((w) => w.toUpperCase()).join(", ")}.`); }
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || e.metaKey || e.ctrlKey) return;
      if (e.key === "Enter") { e.preventDefault(); enter(); }
      else if (e.key === "Backspace") back();
      else if (/^[a-z]$/i.test(e.key)) type(e.key.toLowerCase());
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  if (!words || !d.state) return <div className="page"><p className="muted">Shuffling the letters…</p></div>;
  const at = solvedAt(words, guesses), past = isPast(d.date);
  // Keyboard: the best colour a letter has on any board not yet solved
  const rank: Record<Mark, number> = { b: 0, y: 1, g: 2 };
  const keys: Record<string, Mark> = {};
  words.forEach((w, k) => { if (at[k] !== null) return; for (const [ch, m] of Object.entries(keyMarks(w, guesses))) if (!keys[ch] || rank[m] > rank[keys[ch]]) keys[ch] = m; });
  return (
    <div className="page" style={{ maxWidth: "36rem" }}>
      <p className="eyebrow">a daily word game</p>
      <ArchiveNote date={d.date} path="/four-at-once" />
      <h1 className="h2">Four <em>at once</em></h1>
      <p className="small muted">Four five-letter words, and nine tries to get them all. Every guess goes on all four boards at once. Green is the right letter in the right place, yellow is in that board&apos;s word somewhere else.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>Tries <b>{guesses.length}</b>/{TRIES}</span><span>Found <b>{at.filter((x) => x !== null).length}</b>/4</span><span className="mm-clock">⏱ {clock(d.elapsed)}</span></div>
      <div className="fa-boards">
        {words.map((w, k) => {
          const upto = at[k] ?? guesses.length;
          const rows = guesses.slice(0, upto);
          const showCur = at[k] === null && !over;
          return (
            <div key={k} className={`fa-board ${at[k] !== null ? "solved" : ""}`} role="group" aria-label={`Board ${k + 1}${at[k] !== null ? `, solved in ${at[k]}` : ""}`}>
              {[...Array(TRIES).keys()].map((r) => {
                const g = r < rows.length ? rows[r] : r === rows.length && showCur ? cur : "";
                const marks = r < rows.length ? score(rows[r], w) : null;
                return <div key={r} className="fa-row">{[...Array(5).keys()].map((c) => <span key={c} className={`fa-tile ${marks ? marks[c] : g[c] ? "typed" : ""}`}>{g[c]?.toUpperCase() ?? ""}</span>)}</div>;
              })}
              {over && at[k] === null && <p className="tiny center" style={{ margin: "0.2rem 0 0" }}>{w.toUpperCase()}</p>}
            </div>
          );
        })}
      </div>
      {!over && (
        <div className="fa-keys" aria-label="Keyboard">
          {ROWS.map((row, i) => (
            <div key={i} className="fa-keyrow">
              {i === 2 && <button className="fa-key wide" onClick={enter}>Enter</button>}
              {[...row].map((ch) => <button key={ch} className={`fa-key ${keys[ch] ?? ""}`} onClick={() => type(ch)}>{ch.toUpperCase()}</button>)}
              {i === 2 && <button className="fa-key wide" onClick={back} aria-label="Delete">⌫</button>}
            </div>
          ))}
        </div>
      )}
      {over && (won ? (
        <DoneCard game="four" title="Four at once" date={d.date} past={past} headline={`All four in ${guesses.length} tries, ${clock(d.doneMs ?? 0)} 🎉`} score={pack(guesses.length, d.doneMs ?? 0)} saved={d.saved} onSaved={(b) => { d.setBoard(b); d.setSaved(true); }} />
      ) : (
        <section className="card memory-done" aria-live="polite"><b>So close! {at.filter((x) => x !== null).length} of 4</b><p className="small" style={{ margin: 0 }}>Today&apos;s words: {words.map((w) => w.toUpperCase()).join(", ")}. New ones tomorrow.</p></section>
      ))}
      {!past && <TodayBoard board={d.board} show={(v) => { const u = unpack(v); return `${u.n} tries · ${clock(u.ms)}`; }} note="Fewest tries wins; time breaks a tie." />}
    </div>
  );
}
