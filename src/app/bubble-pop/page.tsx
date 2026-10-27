"use client";
import { useEffect, useRef, useState } from "react";
import ArcadeBoard from "@/components/ArcadeBoard";
import { COLOURS, H, SHOOTER, W, cx, cy, fire, newGame, trace, type State } from "@/lib/bubblePop";
import { addFlag } from "@/lib/trophyFlags";

const BEST = "mm-bubble-best";
const MAX_ANGLE = 1.35;

export default function BubblePop() {
  const [s, setS] = useState<State>(() => newGame(7));
  const [angle, setAngle] = useState(0);
  const [started, setStarted] = useState(false);
  const [best, setBest] = useState(0);
  const [flying, setFlying] = useState<{ path: [number, number][]; t: number; colour: number } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => { try { setBest(Number(localStorage.getItem(BEST)) || 0); } catch {} setS(newGame(Date.now())); }, []);
  useEffect(() => {
    if (!s.over) return;
    if (s.score >= 2000) addFlag("bubble-2000");
    if (s.score > best) { setBest(s.score); try { localStorage.setItem(BEST, String(s.score)); } catch {} }
  }, [s.over]); // eslint-disable-line react-hooks/exhaustive-deps
  // A short animation of the shot along its path, then the result
  useEffect(() => {
    if (!flying) return;
    let raf = 0;
    const frame = () => { setFlying((f) => (f ? { ...f, t: f.t + 1.2 } : f)); raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [!!flying]); // eslint-disable-line react-hooks/exhaustive-deps
  const pathLen = (p: [number, number][]) => p.slice(1).reduce((n, q, k) => n + Math.hypot(q[0] - p[k][0], q[1] - p[k][1]), 0);
  useEffect(() => {
    if (!flying || flying.t < pathLen(flying.path)) return;
    const r = fire(s, angle);
    setS(r.s); setFlying(null);
    if (r.dropped >= 6) addFlag("bubble-avalanche");
  }, [flying?.t]); // eslint-disable-line react-hooks/exhaustive-deps
  function shoot() {
    if (s.over || flying) return;
    setStarted(true);
    setFlying({ path: trace(s, angle).path, t: 0, colour: s.next });
  }
  const aimAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
    setAngle(Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, Math.atan2(x - SHOOTER.x, SHOOTER.y - y))));
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "ArrowLeft") { e.preventDefault(); setAngle((a) => Math.max(-MAX_ANGLE, a - 0.04)); }
      else if (e.key === "ArrowRight") { e.preventDefault(); setAngle((a) => Math.min(MAX_ANGLE, a + 0.04)); }
      else if (e.key === " " || e.key === "ArrowUp") { e.preventDefault(); shoot(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  // Draw
  useEffect(() => {
    const c = canvas.current, ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1, cw = c.clientWidth;
    if (c.width !== Math.round(cw * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(cw * dpr * (H / W)); }
    const k = c.width / W;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#fbe3ea"); g.addColorStop(1, "#f3e6d8");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const ball = (x: number, y: number, col: number) => {
      ctx.fillStyle = COLOURS[col]; ctx.beginPath(); ctx.arc(x, y, 0.93, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.beginPath(); ctx.arc(x - 0.3, y - 0.3, 0.25, 0, Math.PI * 2); ctx.fill();
    };
    s.grid.forEach((v, i) => { if (v !== null) ball(cx(i, s.rows), cy(i), v); });
    // The danger line
    ctx.strokeStyle = "rgba(194,91,120,0.35)"; ctx.lineWidth = 0.08; ctx.setLineDash([0.4, 0.3]);
    ctx.beginPath(); ctx.moveTo(0, SHOOTER.y - 2.5); ctx.lineTo(W, SHOOTER.y - 2.5); ctx.stroke(); ctx.setLineDash([]);
    if (!flying && !s.over) {
      // Aim guide: only the first part, so it's still a game
      const p = trace(s, angle).path; let left = 7;
      ctx.strokeStyle = "rgba(59,39,32,0.45)"; ctx.lineWidth = 0.12; ctx.setLineDash([0.3, 0.35]); ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length && left > 0; i++) { const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]), f = Math.min(1, left / d); ctx.lineTo(p[i - 1][0] + (p[i][0] - p[i - 1][0]) * f, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * f); left -= d; }
      ctx.stroke(); ctx.setLineDash([]);
      ball(SHOOTER.x, SHOOTER.y, s.next);
    }
    if (flying) {
      let t = flying.t, i = 1, [x, y] = flying.path[0];
      for (; i < flying.path.length; i++) { const [ax, ay] = flying.path[i - 1], [bx, by] = flying.path[i], d = Math.hypot(bx - ax, by - ay); if (t <= d) { x = ax + ((bx - ax) * t) / d; y = ay + ((by - ay) * t) / d; break; } t -= d; [x, y] = [bx, by]; }
      ball(x, y, flying.colour);
    }
    ball(SHOOTER.x + 3, SHOOTER.y + 0.3, s.after);
    ctx.fillStyle = "#765749"; ctx.font = "0.7px system-ui"; ctx.textAlign = "center"; ctx.fillText("next", SHOOTER.x + 3, SHOOTER.y + 1.9);
  }, [s, angle, flying]);
  return (
    <div className="page" style={{ maxWidth: "28rem" }}>
      <p className="eyebrow">an arcade game</p>
      <h1 className="h2">Bubble <em>pop</em></h1>
      <p className="small muted">Aim and fire bubbles of syrup. Join three or more of a colour to pop them, and any left hanging drop for double points. Five shots without a pop, or every tenth shot, the ceiling comes down a row. Don&apos;t let it reach the dotted line.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>Score <b>{s.score}</b></span><span>Shots <b>{s.shots}</b></span><span>Best <b>{best}</b></span></div>
      <div className="bb-wrap">
        <canvas ref={canvas} className="bb-canvas" style={{ aspectRatio: `${W} / ${H}`, touchAction: "none" }} role="img" aria-label={`Bubble pop, score ${s.score}`}
          onPointerMove={aimAt} onPointerDown={aimAt} onPointerUp={(e) => { aimAt(e); shoot(); }} />
        {s.over && <div className="bb-over"><b>The ceiling came down: {s.score} points</b><button className="btn btn-pink btn-sm" onClick={() => { setS(newGame(Date.now())); setStarted(true); }}>Play again</button></div>}
      </div>
      <p className="tiny muted center">Touch to aim and let go to fire, or use ← → and space.</p>
      <ArcadeBoard game="bubble" score={s.score} over={s.over && started} />
    </div>
  );
}
