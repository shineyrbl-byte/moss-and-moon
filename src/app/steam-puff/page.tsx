"use client";
import { useEffect, useRef, useState } from "react";
import ArcadeBoard from "@/components/ArcadeBoard";
import { GAP, H, PIPE_W, R, W, X, flap, newGame, step, type State } from "@/lib/steamPuff";
import { addFlag } from "@/lib/trophyFlags";

const BEST = "mm-puff-best";

export default function SteamPuff() {
  const [s, setS] = useState<State>(newGame);
  const [best, setBest] = useState(0);
  const [paused, setPaused] = useState(false);
  const live = useRef(s), canvas = useRef<HTMLCanvasElement>(null);
  live.current = s;
  useEffect(() => { try { setBest(Number(localStorage.getItem(BEST)) || 0); } catch {} }, []);
  useEffect(() => {
    if (!s.started || s.over || paused) return;
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
  }, [s.started, s.over, paused]);
  useEffect(() => {
    if (!s.over) return;
    if (s.score >= 25) addFlag("puff-25");
    if (s.score > best) { setBest(s.score); try { localStorage.setItem(BEST, String(s.score)); } catch {} }
  }, [s.over]); // eslint-disable-line react-hooks/exhaustive-deps
  // Draw
  useEffect(() => {
    const c = canvas.current, ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const css = getComputedStyle(document.documentElement), v = (n: string) => css.getPropertyValue(n).trim();
    const dpr = window.devicePixelRatio || 1, cw = c.clientWidth;
    if (c.width !== Math.round(cw * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(cw * dpr * (H / W)); }
    const k = c.width / W;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = v("--surface-2"); ctx.fillRect(0, 0, W, H);
    for (const p of s.pipes) {
      // Stacks of cups above and below the gap
      for (const [y0, y1] of [[0, p.gapY - GAP / 2], [p.gapY + GAP / 2, H]]) {
        for (let y = y0; y < y1; y += 6) { ctx.fillStyle = (Math.floor(y / 6) % 2) ? "#e391a8" : "#fffaf6"; ctx.fillRect(p.x, y, PIPE_W, Math.min(6, y1 - y)); }
        ctx.strokeStyle = "#b97f52"; ctx.lineWidth = 0.6; ctx.strokeRect(p.x, y0, PIPE_W, y1 - y0);
      }
    }
    // The puff of steam
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    for (const [dx, dy, rr] of [[0, 0, R], [-R * 0.7, R * 0.3, R * 0.65], [R * 0.7, R * 0.35, R * 0.6]]) { ctx.beginPath(); ctx.arc(X + dx, s.y + dy, rr, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#3b2720"; ctx.beginPath(); ctx.arc(X + 1.2, s.y - 0.8, 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = v("--text"); ctx.font = "bold 10px system-ui"; ctx.textAlign = "center"; ctx.fillText(String(s.score), W / 2, 16);
  }, [s]);
  function tap() { if (s.over) { const n = flap(newGame()); live.current = n; setS(n); setPaused(false); return; } const n = flap(live.current); live.current = n; setS(n); setPaused(false); }
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.key === " " || e.key === "ArrowUp") && (e.target as HTMLElement).tagName !== "INPUT" && (e.target as HTMLElement).tagName !== "BUTTON") { e.preventDefault(); tap(); } if (e.key === "p") setPaused((x) => !x); };
    const hide = () => { if (document.hidden) setPaused(true); };
    window.addEventListener("keydown", h); document.addEventListener("visibilitychange", hide);
    return () => { window.removeEventListener("keydown", h); document.removeEventListener("visibilitychange", hide); };
  });
  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">an arcade game</p>
      <h1 className="h2">Steam <em>puff</em></h1>
      <p className="small muted">A puff of steam escapes the espresso machine. Tap (or press space) to puff it upwards, and float it through the gaps between the stacks of cups. Don&apos;t touch the cups or the floor.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>Score <b>{s.score}</b></span><span>Best <b>{best}</b></span></div>
      <div className="bb-wrap">
        <canvas ref={canvas} className="bb-canvas" style={{ aspectRatio: `${W} / ${H}` }} onPointerDown={tap} role="img" aria-label={`Steam puff, score ${s.score}`} />
        {(!s.started || s.over || paused) && (
          <div className="bb-over">
            {s.over ? <><b>Puff! {s.score} gap{s.score === 1 ? "" : "s"}</b><button className="btn btn-pink btn-sm" onClick={tap}>Puff again</button></>
              : paused ? <><b>Paused</b><button className="btn btn-pink btn-sm" onClick={() => setPaused(false)}>Carry on</button></>
              : <button className="btn btn-pink" onClick={tap}>▶ Start puffing</button>}
          </div>
        )}
      </div>
      <ArcadeBoard game="puff" score={s.score} over={s.over} />
    </div>
  );
}
