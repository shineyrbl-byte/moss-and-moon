"use client";
import { useEffect, useRef, useState } from "react";
import ArcadeBoard from "@/components/ArcadeBoard";
import { BALL_R, BUMPERS, CUP, HEIGHT, PIVOTS, ROLLOVERS, WALLS, WIDTH, flipperTip, launch, newState, step, type State } from "@/lib/pinball";
import { addFlag } from "@/lib/trophyFlags";

const BEST = "mm-pinball-best";
const LETTERS = ["C", "A", "F", "É"];

export default function PinballParlour() {
  const [s, setS] = useState<State>(newState);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [best, setBest] = useState(0);
  const live = useRef(s), held = useRef<[boolean, boolean]>([false, false]), canvas = useRef<HTMLCanvasElement>(null);
  live.current = s;
  useEffect(() => { try { setBest(Number(localStorage.getItem(BEST)) || 0); } catch {} }, []);
  useEffect(() => {
    if (!started || s.over || paused) return;
    let raf = 0, last = performance.now();
    const frame = (t: number) => {
      let dt = Math.min(0.05, (t - last) / 1000); last = t;
      let n = live.current;
      while (dt > 0 && !n.over) { const d = Math.min(dt, 1 / 60); n = step(n, d, held.current); dt -= d; }
      live.current = n; setS(n);
      if (!n.over) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [started, s.over, paused]);
  useEffect(() => {
    if (!s.over) return;
    if (s.score >= 20000) addFlag("pinball-20k");
    if (s.score > best) { setBest(s.score); try { localStorage.setItem(BEST, String(s.score)); } catch {} }
  }, [s.over]); // eslint-disable-line react-hooks/exhaustive-deps
  // Draw the table
  useEffect(() => {
    const c = canvas.current, ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dark = document.documentElement.dataset.theme === "dark" || (document.documentElement.dataset.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
    const dpr = window.devicePixelRatio || 1, cw = c.clientWidth;
    if (c.width !== Math.round(cw * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(cw * dpr * (HEIGHT / WIDTH)); }
    const k = c.width / WIDTH;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, HEIGHT); g.addColorStop(0, dark ? "#3a2620" : "#f9dce3"); g.addColorStop(1, dark ? "#24170f" : "#efd9c6");
    ctx.fillStyle = g; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = dark ? "#e6cfbd" : "#5a3a2c"; ctx.lineWidth = 4; ctx.lineCap = "round";
    for (const [x1, y1, x2, y2] of WALLS) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
    // C-A-F-É rollovers
    ROLLOVERS.forEach((r, i) => {
      ctx.fillStyle = s.lit[i] ? "#e8b86a" : dark ? "#5a4034" : "#fffaf6"; ctx.beginPath(); ctx.arc(r.x, r.y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = s.lit[i] ? "#3b2720" : dark ? "#e6cfbd" : "#8a5a40"; ctx.font = "bold 11px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(LETTERS[i], r.x, r.y + 1);
    });
    // Sugar-cube bumpers and the coffee cup
    BUMPERS.forEach((b, i) => {
      ctx.fillStyle = s.flash[i] > 0 ? "#f6da9e" : "#fffaf6"; ctx.strokeStyle = "#c25b78"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#c25b78"; ctx.font = "bold 10px system-ui"; ctx.fillText("100", b.x, b.y + 1);
    });
    ctx.font = "24px system-ui"; ctx.globalAlpha = s.flash[3] > 0 ? 0.6 : 1; ctx.fillText("☕", CUP.x, CUP.y + 2); ctx.globalAlpha = 1;
    // Flippers
    ctx.strokeStyle = "#c25b78"; ctx.lineWidth = 11;
    PIVOTS.forEach((p, i) => { const tip = flipperTip(i, s.angle[i]); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tip.x, tip.y); ctx.stroke(); });
    // The ball
    if (s.ball) { ctx.fillStyle = dark ? "#f6eee7" : "#3b2720"; ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, BALL_R, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.beginPath(); ctx.arc(s.ball.x - 2.5, s.ball.y - 2.5, 2.4, 0, Math.PI * 2); ctx.fill(); }
    if (s.inShooter && started && !s.over) { ctx.fillStyle = dark ? "#f6eee7" : "#3b2720"; ctx.font = "bold 10px system-ui"; ctx.fillText("▲ launch", 301, 553); }
  }, [s, started]);
  function setHeld(k: 0 | 1, on: boolean) { const h: [boolean, boolean] = [...held.current]; h[k] = on; held.current = h; }
  function fire() { if (live.current.inShooter) { const n = launch(live.current, 0.6 + Math.random() * 0.4); live.current = n; setS(n); } }
  function begin() { const n = newState(); live.current = n; setS(n); setStarted(true); setPaused(false); }
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (["ArrowLeft", "z", "Z", "a", "A"].includes(e.key)) { e.preventDefault(); setHeld(0, true); }
      else if (["ArrowRight", "/", "m", "M", "l", "L"].includes(e.key)) { e.preventDefault(); setHeld(1, true); }
      else if (e.key === " " || e.key === "ArrowDown") { e.preventDefault(); if (!started || live.current.over) begin(); else fire(); }
      else if (e.key === "p") setPaused((x) => !x);
    };
    const up = (e: KeyboardEvent) => {
      if (["ArrowLeft", "z", "Z", "a", "A"].includes(e.key)) setHeld(0, false);
      if (["ArrowRight", "/", "m", "M", "l", "L"].includes(e.key)) setHeld(1, false);
    };
    const hide = () => { if (document.hidden) setPaused(true); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); document.addEventListener("visibilitychange", hide);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); document.removeEventListener("visibilitychange", hide); };
  });
  // Touch: the left or right half of the table works that flipper; tapping while the ball waits launches it
  const touches = useRef(new Map<number, 0 | 1>());
  function pointer(e: React.PointerEvent<HTMLCanvasElement>, on: boolean) {
    if (on && live.current.inShooter) { fire(); return; }
    const side: 0 | 1 = e.clientX - e.currentTarget.getBoundingClientRect().left < e.currentTarget.clientWidth / 2 ? 0 : 1;
    if (on) touches.current.set(e.pointerId, side); else touches.current.delete(e.pointerId);
    const sides = [...touches.current.values()];
    held.current = [sides.includes(0), sides.includes(1)];
  }
  return (
    <div className="page" style={{ maxWidth: "26rem" }}>
      <p className="eyebrow">an arcade game</p>
      <h1 className="h2">Pinball <em>parlour</em></h1>
      <p className="small muted">Launch the ball, then keep it in play with the flippers. Sugar-cube bumpers are 100, the coffee cup 250, and rolling over all of C-A-F-É at the top is 1,000. Three balls.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>Score <b>{s.score.toLocaleString("en-IN")}</b></span><span>Balls <b>{s.balls}</b></span><span>Best <b>{best.toLocaleString("en-IN")}</b></span></div>
      <div className="bb-wrap">
        <canvas ref={canvas} className="bb-canvas" style={{ aspectRatio: `${WIDTH} / ${HEIGHT}`, touchAction: "none" }} role="img" aria-label={`Pinball table, score ${s.score}, ${s.balls} balls left`}
          onPointerDown={(e) => pointer(e, true)} onPointerUp={(e) => pointer(e, false)} onPointerCancel={(e) => pointer(e, false)} onPointerLeave={(e) => pointer(e, false)} onContextMenu={(e) => e.preventDefault()} />
        {(!started || s.over || paused) && (
          <div className="bb-over">
            {s.over ? <><b>Game over: {s.score.toLocaleString("en-IN")}</b><button className="btn btn-pink btn-sm" onClick={begin}>Play again</button></>
              : paused ? <><b>Paused</b><button className="btn btn-pink btn-sm" onClick={() => setPaused(false)}>Carry on</button></>
              : <button className="btn btn-pink" onClick={begin}>▶ Start</button>}
          </div>
        )}
      </div>
      <p className="tiny muted center">Phone: hold the left or right half of the table for that flipper, and tap to launch. Keyboard: ← and → (or Z and /), space to launch, P to pause.</p>
      <ArcadeBoard game="pinball" score={s.score} over={s.over} />
    </div>
  );
}
