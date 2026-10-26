"use client";
import "./page.css";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BREW_METHODS, mmss, stepAt } from "@/lib/brewMethods";

/** A short, soft "ding" (no sound file needed) */
function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.65);
    setTimeout(() => ctx.close(), 800);
  } catch {}
}

export default function BrewTimer() {
  const [id, setId] = useState(BREW_METHODS[0].id);
  const m = BREW_METHODS.find((x) => x.id === id)!;
  const [dose, setDose] = useState(m.dose);
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [sound, setSound] = useState(true);
  const started = useRef<number | null>(null);
  const lastStep = useRef(-1);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => { setDose(m.dose); reset(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => {
      const now = (Date.now() - started.current!) / 1000;
      setT(now);
      const s = stepAt(m, now);
      if (s !== lastStep.current) { lastStep.current = s; if (sound) chime(); }
      if (now >= m.total) { setRunning(false); setT(m.total); if (sound) { chime(); setTimeout(chime, 300); } }
    }, 200);
    return () => clearInterval(tick);
  }, [running, m, sound]);
  // Keep the screen on while brewing
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    if (running && nav.wakeLock) nav.wakeLock.request("screen").then((l) => (wake.current = l)).catch(() => {});
    if (!running) { wake.current?.release().catch(() => {}); wake.current = null; }
  }, [running]);

  function start() { started.current = Date.now() - t * 1000; if (t === 0) lastStep.current = -1; setRunning(true); }
  function reset() { setRunning(false); setT(0); started.current = null; lastStep.current = -1; }

  const water = Math.round(dose * m.ratio);
  const cur = stepAt(m, t);
  const done = t >= m.total;
  const next = m.steps[cur + 1];
  const pct = Math.min(100, (t / m.total) * 100);

  return (
    <div className="page narrow brew">
      <p className="eyebrow">at home</p>
      <h1 className="h2">Brew <em>timer</em></h1>
      <div className="chips" role="radiogroup" aria-label="Method" style={{ justifyContent: "flex-start" }}>
        {BREW_METHODS.map((x) => <button key={x.id} role="radio" aria-checked={x.id === id} className={`chip ${x.id === id ? "on" : ""}`} onClick={() => setId(x.id)}>{x.icon} {x.name}</button>)}
      </div>

      <section className="card brew-setup">
        <label className="field small">Coffee (g)
          <span className="stepper"><button type="button" aria-label="Less coffee" onClick={() => setDose((d) => Math.max(5, d - 1))}>−</button><strong>{dose}</strong><button type="button" aria-label="More coffee" onClick={() => setDose((d) => Math.min(80, d + 1))}>+</button></span>
        </label>
        <div className="small"><b>{water} ml</b> water <span className="muted">(1:{m.ratio})</span></div>
        <div className="small muted">Grind: {m.grind}<br />Water: {m.temp}</div>
      </section>

      <section className="card brew-clock" aria-live="polite">
        <div className="brew-time">{mmss(t)}<small className="muted"> / {mmss(m.total)}</small></div>
        <div className="meter" aria-hidden style={{ maxWidth: "none" }}><span style={{ width: `${pct}%` }} /></div>
        <p className="lead" style={{ margin: "0.7rem 0 0.2rem" }}>
          {done ? "✅ Done! Enjoy it ✿" : cur < 0 ? "Ready when you are." : m.steps[cur].label}
          {!done && cur >= 0 && m.steps[cur].water && <b> · up to {Math.round(water * m.steps[cur].water!)} ml</b>}
        </p>
        {!done && next && <p className="small muted">Next at {mmss(next.at)}: {next.label}</p>}
        <div className="row" style={{ gap: "0.5rem", justifyContent: "center", marginTop: "0.6rem" }}>
          {running ? <button className="btn btn-ghost" onClick={() => setRunning(false)}>⏸ Pause</button> : <button className="btn btn-pink" onClick={done ? () => { reset(); setTimeout(start, 0); } : start}>{t > 0 && !done ? "▶︎ Resume" : "▶︎ Start"}</button>}
          <button className="btn btn-ghost" onClick={reset} disabled={t === 0}>↺ Reset</button>
          <button className="btn btn-ghost" aria-pressed={sound} onClick={() => setSound((x) => !x)}>{sound ? "🔔 Sound on" : "🔕 Sound off"}</button>
        </div>
      </section>

      <ol className="brew-steps">
        {m.steps.map((s, i) => (
          <li key={i} className={i === cur && !done ? "now" : i < cur || done ? "past" : ""}>
            <span className="brew-at">{mmss(s.at)}</span>
            <span>{s.label}{s.water ? <b> · {Math.round(water * s.water)} ml</b> : null}</span>
          </li>
        ))}
      </ol>
      <p className="small muted">💡 {m.note}</p>
      <p className="small"><Link href="/recipes">← Drink recipes to make with it</Link></p>
    </div>
  );
}
