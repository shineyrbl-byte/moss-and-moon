"use client";
import "./page.css";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { voterId } from "@/components/LabCard";
import { useStore } from "@/components/Store";
import { shareGrid, type Mark } from "@/lib/wordGame";

type W = { date: string; tries: number; rows: { word: string; marks: Mark[] }[]; solved: boolean; done: boolean; answer?: string; streak: number; best: number; played: number; solvedToday: number };
const KEYS = ["qwertyuiop", "asdfghjkl", "↵zxcvbnm⌫"];
const RANK: Record<Mark, number> = { b: 0, y: 1, g: 2 };

export default function Word() {
  const { toast } = useStore();
  const [w, setW] = useState<W | null>(null);
  const [cur, setCur] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  useEffect(() => { fetch(`/api/word?voter=${voterId()}`).then((r) => r.json()).then(setW).catch(() => toast("Couldn't load today's word.")); }, [toast]);

  const submit = useCallback(async () => {
    if (!w || w.done || busy) return;
    if (cur.length < 5) { setShake(true); setTimeout(() => setShake(false), 400); return toast("Five letters, please"); }
    setBusy(true);
    const r = await fetch("/api/word", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guess: cur, voter: voterId() }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { setShake(true); setTimeout(() => setShake(false), 400); return toast(d.error); }
    setW(d); setCur("");
    if (d.solved) toast(["Genius! ☕", "Brilliant!", "Lovely!", "Nice one!", "Phew!", "Just made it!"][d.rows.length - 1] ?? "Got it!");
  }, [w, cur, busy, toast]);
  const press = useCallback((k: string) => {
    if (!w || w.done) return;
    if (k === "↵") return void submit();
    if (k === "⌫") return setCur((c) => c.slice(0, -1));
    if (/^[a-z]$/.test(k)) setCur((c) => (c.length < 5 ? c + k : c));
  }, [w, submit]);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      if (e.key === "Enter") { e.preventDefault(); press("↵"); }
      else if (e.key === "Backspace") press("⌫");
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [press]);

  if (!w) return <div className="page narrow"><p className="muted">Grinding today&apos;s word…</p></div>;
  const keyState = new Map<string, Mark>();
  for (const r of w.rows) r.word.split("").forEach((ch, i) => { const m = r.marks[i]; if (!keyState.has(ch) || RANK[m] > RANK[keyState.get(ch)!]) keyState.set(ch, m); });
  const grid = Array.from({ length: w.tries }, (_, i) => w.rows[i] ?? (i === w.rows.length && !w.done ? { word: cur, marks: null } : { word: "", marks: null }));
  const share = async () => {
    const text = `Moss & Moon word ${w.date} ${w.solved ? w.rows.length : "X"}/${w.tries}\n${shareGrid(w.rows.map((r) => r.marks))}`;
    try { if (navigator.share) await navigator.share({ text, url: location.href }); else { await navigator.clipboard.writeText(`${text}\n${location.href}`); toast("Copied ✿"); } } catch {}
  };
  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">{new Date(`${w.date}T12:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
      <h1 className="h2">The café <em>word</em></h1>
      <p className="small muted">Guess today&apos;s five-letter word in six tries. Green is the right spot, yellow is in the word somewhere. The answers are all coffee, food or Goa words.</p>
      <div className="word-grid" role="grid" aria-label="Your guesses">
        {grid.map((r, i) => (
          <div key={i} role="row" className={`word-row ${shake && i === w.rows.length ? "shake" : ""}`}>
            {Array.from({ length: 5 }, (_, j) => {
              const ch = r.word[j] ?? "";
              const m = r.marks?.[j];
              return <span key={j} role="gridcell" className={`word-tile ${m ?? (ch ? "typed" : "")}`} aria-label={ch ? `${ch}${m === "g" ? ", right spot" : m === "y" ? ", in the word" : m === "b" ? ", not in the word" : ""}` : "empty"}>{ch}</span>;
            })}
          </div>
        ))}
      </div>
      {w.done ? (
        <section className="card word-after" aria-live="polite">
          <b>{w.solved ? `Got it in ${w.rows.length} 🎉` : "So close ✿"}</b>
          <p className="small" style={{ margin: "0.3rem 0" }}>Today&apos;s word was <b className="word-answer">{w.answer}</b>. {w.solvedToday} of {w.played} {w.played === 1 ? "player" : "players"} got it.</p>
          <p className="small muted" style={{ margin: 0 }}>🔥 {w.streak} day{w.streak === 1 ? "" : "s"} in a row · best {w.best} · new word at midnight</p>
          <div className="row" style={{ gap: "0.5rem", justifyContent: "center", marginTop: "0.6rem" }}>
            <button className="btn btn-pink btn-sm" onClick={share}>Share</button>
            <Link className="btn btn-ghost btn-sm" href="/trivia">Today&apos;s trivia</Link>
          </div>
        </section>
      ) : (
        <div className="word-keys" aria-label="Keyboard">
          {KEYS.map((row) => (
            <div key={row} className="word-key-row">
              {row.split("").map((k) => (
                <button key={k} type="button" className={`word-key ${k === "↵" || k === "⌫" ? "wide" : ""} ${keyState.get(k) ?? ""}`} disabled={busy} onClick={() => press(k)} aria-label={k === "↵" ? "Enter" : k === "⌫" ? "Delete" : k}>{k === "↵" ? "Enter" : k}</button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
