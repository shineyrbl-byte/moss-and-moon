"use client";
import "./page.css";
import { useEffect, useRef, useState } from "react";
import { gameSettings } from "@/lib/gameSettings";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { PADS, beatMs, check, grow } from "@/lib/echo";

type Board = { top: { name: string; score: number }[]; mine: number | null; best: number | null };
const BEST = "mm-echo-best", SOUND = "mm-echo-sound";
type Phase = "idle" | "showing" | "yours" | "over";

export default function BaristasEcho() {
  const { toast } = useStore();
  const [seq, setSeq] = useState<number[]>([]);
  const [taps, setTaps] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [lit, setLit] = useState<number | null>(null);
  const [sound, setSound] = useState(true);
  const [best, setBest] = useState(0);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const timers = useRef<number[]>([]);
  // Rounds you've got right: the run grows as soon as you finish one, so it's always one less than its length
  const score = Math.max(0, seq.length - 1);
  useEffect(() => {
    try { setBest(Number(localStorage.getItem(BEST)) || 0); setName(localStorage.getItem("mm-game-name") ?? ""); const own = localStorage.getItem(SOUND); setSound(own ? own !== "off" : gameSettings().sound); } catch {}
    fetch(`/api/arcade?game=echo&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
    return () => timers.current.forEach(clearTimeout);
  }, []);

  function beep(pad: number, ms: number, wrong = false) {
    if (!sound) return;
    try {
      audio.current ??= new AudioContext();
      const ctx = audio.current, o = ctx.createOscillator(), v = ctx.createGain();
      o.type = wrong ? "sawtooth" : "triangle";
      o.frequency.value = wrong ? 110 : PADS[pad].hz;
      v.gain.setValueAtTime(0.0001, ctx.currentTime);
      v.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      v.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
      o.connect(v).connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + ms / 1000 + 0.05);
    } catch {}
  }
  function flash(pad: number, ms: number) {
    setLit(pad); beep(pad, ms);
    timers.current.push(window.setTimeout(() => setLit(null), ms * 0.8));
  }
  function show(s: number[]) {
    setPhase("showing"); setTaps([]);
    const ms = beatMs(s.length);
    s.forEach((p, k) => timers.current.push(window.setTimeout(() => flash(p, ms), 600 + k * (ms + 120))));
    timers.current.push(window.setTimeout(() => setPhase("yours"), 600 + s.length * (ms + 120)));
  }
  function begin() {
    timers.current.forEach(clearTimeout); timers.current = [];
    const s = grow([]);
    setSeq(s); setSaved(false); show(s);
  }
  function tap(pad: number) {
    if (phase !== "yours") return;
    const t = [...taps, pad];
    const res = check(seq, t);
    if (res === "wrong") {
      setPhase("over"); setLit(null); beep(0, 500, true);
      const sc = seq.length - 1;
      if (sc > best) { setBest(sc); try { localStorage.setItem(BEST, String(sc)); } catch {} if (sc) toast(`New best: ${sc}! 🔔`); }
      return;
    }
    flash(pad, 220);
    setTaps(t);
    if (res === "round") {
      const s = grow(seq);
      setSeq(s);
      timers.current.push(window.setTimeout(() => show(s), 500));
    }
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (/^[1-4]$/.test(e.key)) { e.preventDefault(); tap(Number(e.key) - 1); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/arcade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "echo", score: seq.length - 1, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  const status = phase === "idle" ? "Press start, then listen." : phase === "showing" ? "Listen…" : phase === "yours" ? `Your turn: ${taps.length} of ${seq.length}` : `Wrong one! You remembered ${seq.length - 1}.`;
  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">an arcade game</p>
      <h1 className="h2">Barista&apos;s <em>echo</em></h1>
      <p className="small muted">The café plays a run of sounds: the milk steamer, the cups, the grinder and the till. Play it back in the same order. Every round it adds one more, and it gets quicker. How long a run can you remember?</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}>
        <span>Remembered <b>{score}</b></span><span>Best <b>{best}</b></span>
        <button className="btn btn-ghost btn-sm" onClick={() => { setSound(!sound); try { localStorage.setItem(SOUND, sound ? "off" : "on"); } catch {} }} aria-pressed={sound}>{sound ? "🔊 Sound on" : "🔇 Sound off"}</button>
      </div>
      <p className="center small" aria-live="polite" role="status">{status}</p>
      <div className={`ec-pads ${phase}`}>
        {PADS.map((p, i) => (
          <button key={p.id} className={`ec-pad ec-${p.id} ${lit === i ? "lit" : ""}`} onClick={() => tap(i)} aria-disabled={phase !== "yours"} aria-label={`${p.name} (key ${i + 1})`}>
            <span aria-hidden="true">{p.emoji}</span><small>{p.name}</small>
          </button>
        ))}
      </div>
      <p className="center" style={{ marginTop: "0.8rem" }}>
        {(phase === "idle" || phase === "over") && <button className="btn btn-pink" onClick={begin}>{phase === "over" ? "Play again" : "▶ Start"}</button>}
      </p>
      {phase === "over" && seq.length > 1 && !saved && (
        <div className="row" style={{ justifyContent: "center", alignItems: "end", gap: "0.5rem" }}>
          <label className="field" style={{ maxWidth: "12rem", marginBottom: 0 }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
          <button className="btn btn-pink btn-sm" onClick={save}>Save score</button>
        </div>
      )}
      {saved && <p className="small center">Saved ✓</p>}
      <p className="tiny muted center">Keys 1 to 4 work too. Each pad lights up as well as making a sound, so you can play with the sound off.</p>
      {board && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">This week&apos;s best ears</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{t.score}</b></li>)}</ol> : <p className="small muted">No scores yet this week. Set the first one.</p>}
          <p className="tiny muted">The board starts fresh every Monday.</p>
        </section>
      )}
    </div>
  );
}
