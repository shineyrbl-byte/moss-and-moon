"use client";
import "./page.css";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import { PLANS, clock, nextPhase, phaseMinutes, type Phase } from "@/lib/focus";
import { defaultOptions, rupees } from "@/lib/pricing";
import { itemName } from "@/lib/menu";
import { voterId } from "@/components/LabCard";

type Layer = "rain" | "steam" | "chatter";
const LAYERS: { id: Layer; label: string; icon: string }[] = [
  { id: "rain", label: "Rain on the window", icon: "🌧" },
  { id: "steam", label: "Milk steamer", icon: "🥛" },
  { id: "chatter", label: "Quiet chatter", icon: "💬" },
];
const PHASE_LABEL: Record<Phase, string> = { work: "Focus", short: "Short break", long: "Long break" };
const REFILLS = ["cappuccino", "chai", "iced-brown-sugar", "turmeric-latte", "cookie", "croissant"];

/** Café sounds, made in the browser (no audio files). Each layer has its own volume. */
function makeSounds() {
  const ctx = new AudioContext();
  const sr = ctx.sampleRate;
  const noise = (secs: number, brown: boolean) => {
    const buf = ctx.createBuffer(1, sr * secs, sr);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; } else d[i] = w * 0.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  };
  const gains = {} as Record<Layer, GainNode>;
  for (const l of LAYERS) { gains[l.id] = ctx.createGain(); gains[l.id].gain.value = 0; gains[l.id].connect(ctx.destination); }

  // Rain: brown noise, low-passed
  const rain = noise(4, true);
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1100;
  rain.connect(lp).connect(gains.rain);
  rain.start();

  // Steamer: hissy band of noise that swells for a few seconds now and then
  const steam = noise(3, false);
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 4200; bp.Q.value = 0.8;
  const swell = ctx.createGain(); swell.gain.value = 0;
  steam.connect(bp).connect(swell).connect(gains.steam);
  steam.start();
  const hiss = () => {
    const t = ctx.currentTime + 0.1, len = 3 + Math.random() * 4;
    swell.gain.setValueAtTime(0.0001, t);
    swell.gain.exponentialRampToValueAtTime(0.5, t + 0.6);
    swell.gain.setValueAtTime(0.5, t + len - 0.8);
    swell.gain.exponentialRampToValueAtTime(0.0001, t + len);
    bp.frequency.setValueAtTime(3600, t);
    bp.frequency.linearRampToValueAtTime(5200, t + len); // the pitch climbs as the milk heats
  };
  hiss();
  const steamTimer = setInterval(hiss, 14_000 + Math.random() * 10_000);

  // Chatter: speech-band noise with a wandering volume, plus the odd cup clink
  const talk = noise(6, false);
  const band = ctx.createBiquadFilter(); band.type = "bandpass"; band.frequency.value = 650; band.Q.value = 1.1;
  const murmur = ctx.createGain(); murmur.gain.value = 0.25;
  talk.connect(band).connect(murmur).connect(gains.chatter);
  talk.start();
  const wander = setInterval(() => {
    murmur.gain.linearRampToValueAtTime(0.12 + Math.random() * 0.3, ctx.currentTime + 0.4);
    band.frequency.linearRampToValueAtTime(450 + Math.random() * 500, ctx.currentTime + 0.4);
  }, 450);
  const clink = setInterval(() => {
    if (Math.random() > 0.35) return;
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    o.frequency.value = 2400 + Math.random() * 1600;
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(gains.chatter);
    o.start(t); o.stop(t + 0.55);
  }, 5000);

  return {
    set(l: Layer, v: number) { gains[l].gain.linearRampToValueAtTime(v, ctx.currentTime + 0.3); },
    chime() {
      [784, 1047, 1319].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * 0.25;
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
        o.connect(g).connect(ctx.destination);
        o.start(t); o.stop(t + 1.3);
      });
    },
    resume() { return ctx.resume(); },
    close() { clearInterval(steamTimer); clearInterval(wander); clearInterval(clink); ctx.close().catch(() => {}); },
  };
}

const todayKey = () => `mm-focus-${new Date().toISOString().slice(0, 10)}`;

export default function Focus() {
  const { find, lang, add, toast, setDrawerOpen } = useStore();
  const [planId, setPlanId] = useState("classic");
  const plan = PLANS.find((p) => p.id === planId) ?? PLANS[0];
  const [phase, setPhase] = useState<Phase>("work");
  const [done, setDone] = useState(0); // work rounds finished this sitting
  const [today, setToday] = useState(0); // focus minutes today
  const [left, setLeft] = useState(plan.work * 60);
  const [endsAt, setEndsAt] = useState<number | null>(null); // running if set
  const [vol, setVol] = useState<Record<Layer, number>>({ rain: 0, steam: 0, chatter: 0 });
  const [refill, setRefill] = useState(false);
  const snd = useRef<ReturnType<typeof makeSounds> | null>(null);
  const [together, setTogether] = useState<{ live: number; sessions: number; minutes: number } | null>(null);
  const tell = (event: "ping" | "stop" | "done", minutes?: number) =>
    fetch("/api/focus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voter: voterId(), event, minutes }), keepalive: true }).then((r) => r.json()).then((d) => d.live !== undefined && setTogether(d)).catch(() => {});

  // Focus together: count yourself in while a focus round is running, and see who else is
  const focusing = !!endsAt && phase === "work";
  useEffect(() => {
    if (!focusing) return;
    tell("ping");
    const id = setInterval(() => tell("ping"), 30_000);
    return () => { clearInterval(id); tell("stop"); };
  }, [focusing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const load = () => fetch("/api/focus").then((r) => r.json()).then(setTogether).catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { try { setToday(Number(localStorage.getItem(todayKey()) || 0)); } catch {} return () => snd.current?.close(); }, []);
  useEffect(() => { if (!endsAt) setLeft(phaseMinutes(plan, phase) * 60); }, [planId, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Count down from a fixed end time, so a background tab doesn't drift
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => {
      const s = Math.round((endsAt - Date.now()) / 1000);
      if (s > 0) return setLeft(s);
      snd.current?.chime();
      setEndsAt(null);
      if (phase === "work") {
        const n = done + 1;
        setDone(n);
        const mins = today + plan.work;
        setToday(mins);
        try { localStorage.setItem(todayKey(), String(mins)); } catch {}
        setRefill(true);
        tell("done", plan.work);
        setPhase(nextPhase("work", n));
      } else { setRefill(false); setPhase("work"); }
      try { if (document.hidden && Notification.permission === "granted") new Notification(phase === "work" ? "Break time ☕" : "Back to it ✿"); } catch {}
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [endsAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.title = endsAt ? `${clock(left)} · ${PHASE_LABEL[phase]} · Moss & Moon` : "Focus corner · Moss & Moon";
  }, [left, endsAt, phase]);

  const sounds = () => (snd.current ??= makeSounds());
  function start() {
    sounds().resume();
    try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch {}
    setEndsAt(Date.now() + left * 1000);
  }
  const pause = () => { setEndsAt(null); };
  const reset = () => { setEndsAt(null); setLeft(phaseMinutes(plan, phase) * 60); };
  const skip = () => { setEndsAt(null); setPhase(phase === "work" ? nextPhase("work", done) : "work"); };
  function setLayer(l: Layer, v: number) { sounds().resume(); sounds().set(l, v); setVol((x) => ({ ...x, [l]: v })); }
  const order = (id: string) => { const m = find(id); if (m) { add(m.id, defaultOptions(m), 1); toast(`${itemName(m, lang)} added ✿`); setDrawerOpen(true); } };

  const total = phaseMinutes(plan, phase) * 60;
  const refills = REFILLS.map((id) => find(id)).filter((m) => m && !m.soldOut).slice(0, 3);
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">study with us</p>
      <h1 className="h2">Focus <em>corner</em></h1>
      <p className="lead">Pick a rhythm, turn up the café, and get the thing done. We&apos;ll chime when it&apos;s time for a break.</p>

      <div className="chips" role="radiogroup" aria-label="Timer" style={{ justifyContent: "flex-start" }}>
        {PLANS.map((p) => <button key={p.id} role="radio" aria-checked={planId === p.id} className={`chip ${planId === p.id ? "on" : ""}`} disabled={!!endsAt} onClick={() => setPlanId(p.id)}>{p.label}</button>)}
      </div>

      <section className={`card focus-timer ${phase}`} aria-live="polite">
        <span className="focus-phase">{PHASE_LABEL[phase]}{phase === "work" ? ` · round ${done + 1}` : ""}</span>
        <span className="focus-clock" role="timer">{clock(left)}</span>
        <div className="meter" aria-hidden><span style={{ width: `${(1 - left / total) * 100}%` }} /></div>
        <div className="row" style={{ justifyContent: "center", gap: "0.5rem" }}>
          {endsAt ? <button className="btn btn-pink" onClick={pause}>⏸ Pause</button> : <button className="btn btn-pink" onClick={start}>▶ {left < total ? "Resume" : "Start"}</button>}
          <button className="btn btn-ghost" onClick={reset}>↺ Reset</button>
          <button className="btn btn-ghost" onClick={skip}>{phase === "work" ? "Skip to break" : "Skip break"}</button>
        </div>
        <span className="small muted">🍃 {today} min focused today{done ? ` · ${done} round${done > 1 ? "s" : ""} this sitting` : ""}</span>
      </section>
      {together && (
        <p className="focus-together small" aria-live="polite">
          {together.live > 0 ? <>👥 <b>{together.live}</b> {together.live === 1 ? (focusing ? "person focusing: you! Others will join." : "person focusing right now") : `people focusing right now${focusing ? ", including you" : ""}`}</> : "👥 Nobody's focusing right now. Start a round and lead the way."}
          {together.sessions > 0 && <span className="muted"> · {together.sessions} session{together.sessions === 1 ? "" : "s"} ({together.minutes} min) finished today</span>}
        </p>
      )}

      {refill && phase !== "work" && refills.length > 0 && (
        <section className="card reward-banner" style={{ marginTop: "1rem" }}>
          <b>Nice work ✿ Time for a refill?</b>
          <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
            {refills.map((m) => <button key={m!.id} className="chip" onClick={() => order(m!.id)}>＋ {itemName(m!, lang)} · {rupees(m!.price)}</button>)}
          </div>
        </section>
      )}

      <section className="card" style={{ padding: "1rem 1.2rem", marginTop: "1rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Café sounds</h2>
        {LAYERS.map((l) => (
          <label key={l.id} className="focus-layer">
            <span>{l.icon} {l.label}</span>
            <input type="range" min={0} max={1} step={0.05} value={vol[l.id]} onChange={(e) => setLayer(l.id, Number(e.target.value))} aria-label={`${l.label} volume`} />
          </label>
        ))}
        <p className="tiny muted">Made in your browser, nothing to download. Works best with headphones.</p>
      </section>
    </div>
  );
}
