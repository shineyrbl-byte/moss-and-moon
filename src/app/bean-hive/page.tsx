"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";

type Step = { name: string; at: number };
type Hive = {
  date: string; centre: string; outer: string[]; found: string[]; score: number; max: number; rank: string; steps: Step[];
  words: number; pangrams: number; today: { played: number; strong: number }; streak: number;
  yesterday: { centre: string; outer: string[]; words: string[]; pangrams: string[] };
};

export default function BeanHive() {
  const { toast } = useStore();
  const [h, setH] = useState<Hive | null>(null);
  const [ring, setRing] = useState<string[]>([]);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [showY, setShowY] = useState(false);
  useEffect(() => {
    fetch(`/api/hive?voter=${voterId()}`).then((r) => r.json()).then((d: Hive) => { setH(d); setRing(d.outer); }).catch(() => {});
  }, []);
  const letters = h ? h.centre + ring.join("") : "";
  async function enter() {
    if (!h || busy || !word) return;
    setBusy(true);
    const r = await fetch("/api/hive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ word, voter: voterId() }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { toast(d.error); setShake(true); setTimeout(() => setShake(false), 400); return; }
    const before = h.rank;
    setH(d); setWord("");
    const a = d.added as { word: string; points: number; pangram: boolean; bonus: boolean };
    toast(a.pangram ? `All seven! +${a.points} 🐝✨` : a.bonus ? `A rare one! +${a.points}` : `+${a.points}`);
    if (d.rank !== before) setTimeout(() => toast(`You're now at ${d.rank} ☕`), 900);
  }
  function shuffle() {
    const r = [...ring];
    for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
    setRing(r);
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!h || e.metaKey || e.ctrlKey || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "Enter") { e.preventDefault(); enter(); }
      else if (e.key === "Backspace") setWord((w) => w.slice(0, -1));
      else if (/^[a-z]$/i.test(e.key) && letters.includes(e.key.toLowerCase())) setWord((w) => (w + e.key.toLowerCase()).slice(0, 19));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  async function share() {
    if (!h) return;
    const text = `Bean hive ${h.date} 🐝\n${h.rank} · ${h.found.length} word${h.found.length === 1 ? "" : "s"}, ${h.score} points`;
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast("Copied 📋"); } } catch {}
  }
  if (!h) return <div className="page"><p className="muted">Waking the bees…</p></div>;
  const next = h.steps.find((s) => s.at > h.score);
  const top = h.steps[h.steps.length - 1].at;
  const sorted = [...h.found].sort();
  const all7 = (w: string) => [...new Set(letters)].every((c) => w.includes(c));
  return (
    <div className="page" style={{ maxWidth: "36rem" }}>
      <p className="eyebrow">a daily word puzzle</p>
      <h1 className="h2">Bean <em>hive</em></h1>
      <p className="small muted">Make words of four letters or more. Every word must use the middle letter, and letters can be used again. Find a word that uses all seven for a bonus. New letters every morning.</p>

      <div className="hive-rank" aria-live="polite">
        <b>{h.rank}</b>
        <div className="hive-track" role="progressbar" aria-valuemin={0} aria-valuemax={top} aria-valuenow={h.score} aria-label="Your rank">
          <span className="hive-fill" style={{ width: `${Math.min(100, (h.score / top) * 100)}%` }} />
          {h.steps.map((s) => <i key={s.name} className={h.score >= s.at ? "on" : ""} style={{ left: `${(s.at / top) * 100}%` }} title={s.name} />)}
        </div>
        <span className="small muted">{h.score} pts{next ? ` · ${next.at - h.score} to ${next.name}` : " · every word! 🌙"}</span>
      </div>

      <div className={`hive-word ${shake ? "shake" : ""}`} aria-live="polite" aria-label="Your word">
        {word ? [...word].map((c, i) => <span key={i} className={c === h.centre ? "mid" : ""}>{c}</span>) : <span className="muted">Tap the letters</span>}
      </div>

      <div className="hive" role="group" aria-label="Letters">
        <button className="hive-cell mid" onClick={() => setWord((w) => (w + h.centre).slice(0, 19))} aria-label={`Middle letter ${h.centre}`}>{h.centre}</button>
        {ring.map((c, i) => <button key={c} className={`hive-cell p${i}`} onClick={() => setWord((w) => (w + c).slice(0, 19))} aria-label={`Letter ${c}`}>{c}</button>)}
      </div>

      <div className="row" style={{ justifyContent: "center", gap: "0.5rem" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setWord((w) => w.slice(0, -1))} disabled={!word}>Delete</button>
        <button className="btn btn-ghost btn-sm" onClick={shuffle} aria-label="Shuffle the letters">🔀</button>
        <button className="btn btn-pink btn-sm" onClick={enter} disabled={word.length < 4 || busy}>Enter</button>
      </div>

      <section className="card hive-found">
        <p className="small" style={{ margin: 0 }}><b>{h.found.length}</b> of about {h.words} everyday words found · {h.pangrams === 1 ? "one word uses" : `${h.pangrams} words use`} all seven letters</p>
        {sorted.length > 0 && <ul>{sorted.map((w) => <li key={w} className={all7(w) ? "pan" : ""}>{w}</li>)}</ul>}
        {h.found.length > 0 && <button className="btn btn-ghost btn-sm" onClick={share}>Share my rank</button>}
      </section>

      <p className="tiny muted">{h.today.played ? `${h.today.played} ${h.today.played === 1 ? "person has" : "people have"} played today${h.today.strong ? `, ${h.today.strong} reached Double shot` : ""}.` : "Nobody's played yet today."}{h.streak > 1 ? ` You're on a ${h.streak}-day streak 🔥` : ""} Rarer real words count as bonus points, but you never need them for the top rank.</p>

      <section style={{ marginTop: "1rem" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowY(!showY)} aria-expanded={showY}>{showY ? "Hide" : "Show"} yesterday&apos;s words</button>
        {showY && (
          <div className="card" style={{ marginTop: "0.6rem", padding: "0.8rem 1rem" }}>
            <p className="small" style={{ marginTop: 0 }}>Middle letter <b>{h.yesterday.centre.toUpperCase()}</b> with {h.yesterday.outer.map((c) => c.toUpperCase()).join(" ")}. All seven: <b>{h.yesterday.pangrams.join(", ")}</b></p>
            <p className="small" style={{ marginBottom: 0 }}>{[...h.yesterday.words].sort().join(" · ")}</p>
          </div>
        )}
      </section>
    </div>
  );
}
