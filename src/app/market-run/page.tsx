"use client";
import { useEffect, useRef, useState } from "react";
import ArcadeBoard from "@/components/ArcadeBoard";
import { GROUND, H, W, duck, jump, newGame, runnerBox, step, type State } from "@/lib/marketRun";
import { addFlag } from "@/lib/trophyFlags";

const BEST = "mm-run-best";

export default function MarketRun() {
  const [s, setS] = useState<State>(() => newGame(1));
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [best, setBest] = useState(0);
  const live = useRef(s), canvas = useRef<HTMLCanvasElement>(null);
  live.current = s;
  useEffect(() => { try { setBest(Number(localStorage.getItem(BEST)) || 0); } catch {} }, []);
  useEffect(() => {
    if (!playing || paused || s.over) return;
    let raf = 0, last = performance.now();
    const frame = (t: number) => {
      let dt = Math.min(0.05, (t - last) / 1000); last = t;
      let n = live.current;
      while (dt > 0 && !n.over) { const d = Math.min(dt, 1 / 120); n = step(n, d); dt -= d; }
      live.current = n; setS(n);
      if (!n.over) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, paused, s.over]);
  useEffect(() => {
    if (!s.over) return;
    if (s.score >= 3000) addFlag("run-3000");
    if (s.score > best) { setBest(s.score); try { localStorage.setItem(BEST, String(s.score)); } catch {} }
  }, [s.over]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (n: State) => { live.current = n; setS(n); };
  function begin() { set(newGame(Math.floor(Math.random() * 1e9))); setPlaying(true); setPaused(false); }
  function hop() { if (!playing || live.current.over) { begin(); return; } setPaused(false); set(jump(live.current)); }
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === " " || e.key === "ArrowUp") { e.preventDefault(); hop(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); set(duck(live.current, true)); }
      else if (e.key === "p" && playing) setPaused((x) => !x);
    };
    const up = (e: KeyboardEvent) => { if (e.key === "ArrowDown") set(duck(live.current, false)); };
    const hide = () => { if (document.hidden) setPaused(true); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); document.addEventListener("visibilitychange", hide);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); document.removeEventListener("visibilitychange", hide); };
  });
  // Draw the market
  useEffect(() => {
    const c = canvas.current, ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1, cw = c.clientWidth;
    if (c.width !== Math.round(cw * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(cw * dpr * (H / W)); }
    const k = c.width / W;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#fbe3ea"); g.addColorStop(1, "#f3e6d8");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // Stalls scrolling past in the background
    ctx.fillStyle = "rgba(194,91,120,0.15)";
    for (let i = 0; i < 6; i++) { const x = ((i * 90 - s.dist * 0.3) % 540 + 540) % 540 - 70; ctx.fillRect(x, 70, 60, 90); ctx.fillStyle = i % 2 ? "rgba(194,91,120,0.15)" : "rgba(138,90,64,0.15)"; }
    ctx.fillStyle = "#8a5a40"; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    for (const t of s.things) {
      if (t.kind === "crate") { ctx.fillStyle = "#c99a6b"; ctx.fillRect(t.x, GROUND - t.h, t.w, t.h); ctx.strokeStyle = "#8a5a40"; ctx.lineWidth = 2; ctx.strokeRect(t.x, GROUND - t.h, t.w, t.h); ctx.font = "12px system-ui"; ctx.fillText("🥭", t.x + t.w / 2, GROUND - t.h + 14); }
      else if (t.kind === "awning") { ctx.fillStyle = "#e391a8"; ctx.fillRect(t.x, GROUND - 58, t.w, 30); for (let x = 0; x < t.w; x += 12) { ctx.fillStyle = x % 24 ? "#fffaf6" : "#e391a8"; ctx.fillRect(t.x + x, GROUND - 58, 6, 30); } ctx.fillStyle = "#5a3a2c"; ctx.fillRect(t.x + 2, GROUND - 28, 3, 28); ctx.fillRect(t.x + t.w - 5, GROUND - 28, 3, 28); }
      else { ctx.font = "16px system-ui"; ctx.fillText("☕", t.x + 8, GROUND - 52); }
    }
    const me = runnerBox(s);
    ctx.font = `${s.ducking ? 24 : 34}px system-ui`; ctx.fillText(s.ducking ? "🧑‍🍳" : "🏃", me.x + 12, me.bottom + 2);
    ctx.fillStyle = "#3b2720"; ctx.font = "bold 14px system-ui"; ctx.textAlign = "right"; ctx.textBaseline = "top"; ctx.fillText(`${s.score}`, W - 10, 8);
  }, [s]);
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">an arcade game</p>
      <h1 className="h2">Market <em>run</em></h1>
      <p className="small muted">The barista&apos;s dashing through the morning market with the coffees. Tap (or space) to jump the fruit crates, and hold down (or swipe down) to duck under the awnings. Grab the floating coffees for 50. It gets faster and faster.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>Score <b>{s.score}</b></span><span>☕ <b>{s.cups}</b></span><span>Best <b>{best}</b></span></div>
      <div className="bb-wrap">
        <canvas ref={canvas} className="bb-canvas" style={{ aspectRatio: `${W} / ${H}`, touchAction: "none" }} role="img" aria-label={`Market run, score ${s.score}`}
          onPointerDown={(e) => { (e.currentTarget as HTMLCanvasElement).dataset.y = String(e.clientY); hop(); }}
          onPointerMove={(e) => { const y0 = Number((e.currentTarget as HTMLCanvasElement).dataset.y ?? NaN); if (e.buttons && e.clientY - y0 > 25) set(duck(live.current, true)); }}
          onPointerUp={() => set(duck(live.current, false))} />
        {(!playing || s.over || paused) && (
          <div className="bb-over">
            {s.over ? <><b>Splat! {s.score} points</b><button className="btn btn-pink btn-sm" onClick={begin}>Run again</button></>
              : paused ? <><b>Paused</b><button className="btn btn-pink btn-sm" onClick={() => setPaused(false)}>Carry on</button></>
              : <button className="btn btn-pink" onClick={begin}>▶ Start running</button>}
          </div>
        )}
      </div>
      <p className="tiny muted center">Space or ↑ jumps, ↓ ducks, P pauses.</p>
      <ArcadeBoard game="run" score={s.score} over={s.over} />
    </div>
  );
}
