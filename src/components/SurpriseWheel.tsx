"use client";
import { useState } from "react";
import { defaultOptions } from "@/lib/pricing";
import { useStore } from "./Store";
import Reveal from "./Reveal";

type Spin = { wheel: { id: string; name: string }[]; index: number; code: string | null; off: number };
const COLOURS = ["#f6c6d3", "#ead6b4", "#cfe0c3", "#f3d9a4", "#e8c1d8", "#d9cbbd", "#f7d1c4", "#c9dbe0"];

/** Spin for a random drink, and sometimes a 10% code for today */
export default function SurpriseWheel() {
  const { find, add, toast, setDrawerOpen } = useStore();
  const [s, setS] = useState<Spin | null>(null);
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [done, setDone] = useState(false);

  async function spin() {
    setSpinning(true);
    setDone(false);
    const r = await fetch("/api/surprise", { method: "POST" });
    const d = await r.json();
    if (!r.ok) { setSpinning(false); return toast(d.error); }
    setS(d);
    // Land the chosen slice under the pointer at the top, after a few full turns
    const n = d.wheel.length;
    const slice = 360 / n;
    const target = 360 - (d.index * slice + slice / 2);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setAngle((a) => a - (a % 360) + (reduce ? 0 : 360 * 5) + target);
    setTimeout(() => { setSpinning(false); setDone(true); }, reduce ? 50 : 3600);
  }

  const won = s && done ? s.wheel[s.index] : null;
  const item = won ? find(won.id) : undefined;
  const n = s?.wheel.length ?? 8;
  const gradient = `conic-gradient(${Array.from({ length: n }, (_, i) => `${COLOURS[i % COLOURS.length]} ${(i * 100) / n}% ${((i + 1) * 100) / n}%`).join(", ")})`;

  return (
    <Reveal id="surprise" className="section">
      <div className="surprise">
        <div className="wheel-wrap">
          <span className="wheel-pointer" aria-hidden>▼</span>
          <div className="wheel" style={{ background: gradient, transform: `rotate(${angle}deg)` }} aria-hidden>
            {(s?.wheel ?? Array.from({ length: 8 }, (_, i) => ({ id: String(i), name: ["Latte", "Matcha", "Chai", "Mocha", "Frappé", "Smoothie", "Mojito", "Cold brew"][i] }))).map((w, i) => (
              <span key={w.id} className="wheel-label" style={{ transform: `rotate(${(i + 0.5) * (360 / n) - 90}deg) translate(34px, -50%)` }}>{w.name.split(" ").slice(0, 2).join(" ")}</span>
            ))}
          </div>
        </div>
        <div className="surprise-text">
          <p className="eyebrow">can&apos;t decide?</p>
          <h2>Let the <em>wheel</em> choose</h2>
          {won ? (
            <div className="surprise-result" aria-live="polite">
              <p className="lead">The wheel says: <b>{won.name}</b> ✿</p>
              {s?.code && <p className="reward-banner">🎉 Lucky you! <b>{s.off}% off</b> today with code <b className="code">{s.code}</b>. It&apos;s added to your tray.</p>}
              <div className="row">
                {item && <button className="btn btn-pink" onClick={() => {
                  add(item.id, defaultOptions(item), 1);
                  if (s?.code) try { sessionStorage.setItem("mm-promo", s.code); } catch {}
                  toast(`${item.name} added ✿`);
                  setDrawerOpen(true);
                }}>Add it to my tray</button>}
                <button className="btn btn-ghost" onClick={spin} disabled={spinning}>Spin again</button>
              </div>
            </div>
          ) : (
            <>
              <p className="lead">Spin for a random drink. Sometimes it lands on a little discount too.</p>
              <button className="btn btn-pink" onClick={spin} disabled={spinning}>{spinning ? "Spinning…" : "🎡 Spin the wheel"}</button>
            </>
          )}
        </div>
      </div>
    </Reveal>
  );
}
