"use client";
import "./page.css";
import { useEffect, useState } from "react";
import { LIVES, clueFor, guess, newWord, shown, wrong, type State } from "@/lib/hangman";
import { addFlag } from "@/lib/trophyFlags";

const SAVE = "mm-hangman";
const ABC = "abcdefghijklmnopqrstuvwxyz".split("");

export default function CafeHangman() {
  const [s, setS] = useState<State | null>(null);
  const [rec, setRec] = useState({ streak: 0, best: 0, played: [] as string[] });
  useEffect(() => {
    let r = { streak: 0, best: 0, played: [] as string[] };
    try { const v = JSON.parse(localStorage.getItem(SAVE) ?? "null"); if (v) r = { ...r, ...v }; } catch {}
    setRec(r); setS(newWord(Math.random, r.played));
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.target as HTMLElement).tagName !== "INPUT" && /^[a-z]$/i.test(e.key) && !e.metaKey && !e.ctrlKey) setS((x) => (x ? guess(x, e.key) : x)); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => {
    if (!s?.over) return;
    const streak = s.won ? rec.streak + 1 : 0, next = { streak, best: Math.max(rec.best, streak), played: [...rec.played, s.word].slice(-60) };
    if (streak >= 5) addFlag("hangman-five");
    setRec(next); try { localStorage.setItem(SAVE, JSON.stringify(next)); } catch {}
  }, [s?.over]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return <div className="page"><p className="muted">Choosing a word…</p></div>;
  const miss = wrong(s), level = 1 - miss / LIVES;
  return (
    <div className="page" style={{ maxWidth: "32rem" }}>
      <p className="eyebrow">a word game</p>
      <h1 className="h2">Café <em>hangman</em></h1>
      <p className="small muted">Guess the café word one letter at a time. Every wrong letter sips from the cup; seven and it&apos;s empty. The clue tells you what kind of thing it is.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>Streak <b>{rec.streak}</b></span><span>Best <b>{rec.best}</b></span><span>Wrong <b>{miss}</b>/{LIVES}</span></div>
      <svg viewBox="0 0 100 100" className="hm-cup" role="img" aria-label={`The cup is ${Math.round(level * 100)}% full`}>
        <defs><clipPath id="hm-in"><path d="M24 30 h52 l-6 52 a6 6 0 0 1 -6 5 h-28 a6 6 0 0 1 -6 -5 z" /></clipPath></defs>
        <rect x="0" y={30 + (1 - level) * 57} width="100" height="70" fill="#8a5a40" clipPath="url(#hm-in)" />
        <path d="M24 30 h52 l-6 52 a6 6 0 0 1 -6 5 h-28 a6 6 0 0 1 -6 -5 z" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="M74 42 q14 2 10 16 q-3 8 -12 8" fill="none" stroke="currentColor" strokeWidth="3" />
      </svg>
      <p className="center small muted">Clue: {clueFor(s.word)}</p>
      <p className="hm-word" aria-label={s.over ? `The word was ${s.word}` : `${shown(s).filter((c) => c === "_").length} letters still hidden`}>{shown(s).map((c, k) => <span key={k} className={!s.guessed.includes(s.word[k]) && s.over ? "missed" : ""}>{c === "_" ? "" : c}</span>)}</p>
      {s.over ? (
        <p className="center"><b>{s.won ? "Got it! ☕🎉" : `The cup's empty. It was ${s.word.toUpperCase()}.`}</b><br /><button className="btn btn-pink btn-sm" style={{ marginTop: "0.6rem" }} onClick={() => setS(newWord(Math.random, rec.played))}>Next word</button></p>
      ) : (
        <div className="hm-keys" role="group" aria-label="Letters">
          {ABC.map((l) => { const used = s.guessed.includes(l), good = used && s.word.includes(l); return <button key={l} className={`hm-key ${used ? (good ? "good" : "bad") : ""}`} disabled={used} onClick={() => setS(guess(s, l))} aria-label={`${l}${used ? (good ? ", in the word" : ", not in the word") : ""}`}>{l.toUpperCase()}</button>; })}
        </div>
      )}
    </div>
  );
}
