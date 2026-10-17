"use client";
import { useRef, useState } from "react";

// Café ambience made entirely in the browser (no audio files):
// soft rain on the window + a gentle vinyl crackle.
export default function AmbientSound() {
  const [on, setOn] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);

  function build() {
    const ctx = new AudioContext();
    const sr = ctx.sampleRate;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // Rain: "brown" noise through a low-pass filter
    const rainBuf = ctx.createBuffer(1, sr * 4, sr);
    const r = rainBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < r.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      r[i] = last * 3.2;
    }
    const rain = ctx.createBufferSource();
    rain.buffer = rainBuf;
    rain.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1100;
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.55;
    rain.connect(lp).connect(rainGain).connect(master);

    // Vinyl crackle: rare tiny pops
    const crBuf = ctx.createBuffer(1, sr * 5, sr);
    const c = crBuf.getChannelData(0);
    for (let i = 0; i < c.length; i++) {
      if (Math.random() < 0.00035) {
        const amp = Math.random() * 0.5;
        for (let j = 0; j < 40 && i + j < c.length; j++) c[i + j] += (Math.random() * 2 - 1) * amp * Math.exp(-j / 6);
      }
    }
    const crackle = ctx.createBufferSource();
    crackle.buffer = crBuf;
    crackle.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 900;
    const crGain = ctx.createGain();
    crGain.gain.value = 0.35;
    crackle.connect(hp).connect(crGain).connect(master);

    rain.start();
    crackle.start();
    ctxRef.current = ctx;
    masterRef.current = master;
  }

  async function toggle() {
    if (!ctxRef.current) build();
    const ctx = ctxRef.current!;
    const g = masterRef.current!.gain;
    const t = ctx.currentTime;
    g.cancelScheduledValues(t);
    if (!on) {
      await ctx.resume();
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0.5, t + 1.5);
    } else {
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0, t + 0.8);
    }
    setOn(!on);
  }

  return (
    <button className={`icon-btn ${on ? "on" : ""}`} onClick={toggle} aria-pressed={on} aria-label="Toggle café ambience sounds" title={on ? "Mute ambience" : "Play rain & vinyl ambience"}>
      {on ? "🌧" : "♫"}
    </button>
  );
}
