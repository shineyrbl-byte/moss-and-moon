"use client";
import "./page.css";
import { useEffect, useRef, useState } from "react";
import { BALL_R, H, HOLES, HOLE_R, PAR, W, newRound, nextHole, putt, step, total, type State } from "@/lib/miniGolf";
import { addFlag } from "@/lib/trophyFlags";

const BEST = "mm-golf-best";

export default function MiniGolf() {
  const [s, setS] = useState<State>(newRound);
  const [best, setBest] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null), live = useRef(s);
  live.current = s;
  useEffect(() => { try { const b = Number(localStorage.getItem(BEST)); if (b) setBest(b); } catch {} }, []);
  useEffect(() => {
    if (!s.moving) return;
    let raf = 0, last = performance.now();
    const frame = (t: number) => { const dt = Math.min(0.05, (t - last) / 1000); last = t; const n = step(live.current, dt); live.current = n; setS(n); if (n.moving) raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [s.moving]);
  useEffect(() => {
    if (!s.sunk) return;
    if (s.strokes[s.hole] === 1) addFlag("golf-ace");
    const id = setTimeout(() => setS((x) => nextHole(x)), 1100);
    return () => clearTimeout(id);
  }, [s.sunk, s.hole]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!s.done) return;
    const t = total(s);
    if (t <= PAR) addFlag("golf-par");
    if (best === null || t < best) { setBest(t); try { localStorage.setItem(BEST, String(t)); } catch {} }
  }, [s.done]); // eslint-disable-line react-hooks/exhaustive-deps
  const hole = HOLES[s.hole];
  const toTable = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; };
  // Draw
  useEffect(() => {
    const c = canvas.current, ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1, cw = c.clientWidth;
    if (c.width !== Math.round(cw * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(cw * dpr * (H / W)); }
    const k = c.width / W;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = "#6f8f63"; ctx.fillRect(0, 0, W, H);
    // The green inside the outer walls
    const xs = hole.walls.flatMap(([a, , b]) => [a, b]), ys = hole.walls.flatMap(([, a, , b]) => [a, b]);
    ctx.fillStyle = "#8fb77d"; ctx.fillRect(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    ctx.strokeStyle = "#5a3a2c"; ctx.lineWidth = 6; ctx.lineCap = "round";
    for (const [x1, y1, x2, y2] of hole.walls) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
    for (const b of hole.bumpers) { ctx.fillStyle = "#fffaf6"; ctx.strokeStyle = "#c25b78"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.font = `${b.r}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🍬", b.x, b.y + 1); }
    ctx.fillStyle = "#2b1d18"; ctx.beginPath(); ctx.arc(hole.cup[0], hole.cup[1], HOLE_R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#fffaf6"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hole.cup[0], hole.cup[1]); ctx.lineTo(hole.cup[0], hole.cup[1] - 34); ctx.stroke();
    ctx.fillStyle = "#e391a8"; ctx.beginPath(); ctx.moveTo(hole.cup[0], hole.cup[1] - 34); ctx.lineTo(hole.cup[0] + 16, hole.cup[1] - 28); ctx.lineTo(hole.cup[0], hole.cup[1] - 22); ctx.fill();
    if (!s.sunk) { ctx.fillStyle = "#fffaf6"; ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, BALL_R, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1; ctx.stroke(); }
    if (drag && !s.moving) {
      // Pull back to aim: the arrow points where the ball will go, longer for more power
      const dx = s.ball.x - drag.x, dy = s.ball.y - drag.y, len = Math.min(120, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
      ctx.strokeStyle = `hsl(${120 - len}, 70%, 45%)`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(s.ball.x, s.ball.y); ctx.lineTo(s.ball.x + Math.cos(a) * len, s.ball.y + Math.sin(a) * len); ctx.stroke();
    }
  }, [s, drag, hole]);
  const t = total(s), parSoFar = HOLES.slice(0, s.hole + (s.sunk ? 1 : 0)).reduce((a, h) => a + h.par, 0), done = HOLES.slice(0, s.hole + (s.sunk || s.done ? 1 : 0));
  const vsPar = done.reduce((a, h, i) => a + s.strokes[i] - h.par, 0);
  return (
    <div className="page" style={{ maxWidth: "26rem" }}>
      <p className="eyebrow">a game</p>
      <h1 className="h2">Mini <em>golf</em></h1>
      <p className="small muted">Nine little holes round the café. Pull back from the ball (drag away from where you want it to go) and let go to putt: the further you pull, the harder it goes. Six over par and you pick up and move on.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>Hole <b>{s.hole + 1}</b>/9 · par {hole.par}</span><span>Strokes <b>{s.strokes[s.hole]}</b></span><span>{parSoFar ? `${vsPar > 0 ? "+" : ""}${vsPar || "E"}` : "E"}</span>{best !== null && <span>Best <b>{best}</b></span>}</div>
      <p className="center small" style={{ margin: "0.2rem 0" }}><b>{hole.name}</b>{s.sunk ? (s.strokes[s.hole] === 1 ? " · Hole in one! ⛳🎉" : ` · In, in ${s.strokes[s.hole]}`) : ""}</p>
      <div className="bb-wrap">
        <canvas ref={canvas} className="bb-canvas" style={{ aspectRatio: `${W} / ${H}`, touchAction: "none" }} role="img" aria-label={`${hole.name}, hole ${s.hole + 1}, ${s.strokes[s.hole]} strokes so far`}
          onPointerDown={(e) => { if (!s.moving && !s.sunk) { e.currentTarget.setPointerCapture(e.pointerId); setDrag(toTable(e)); } }}
          onPointerMove={(e) => { if (drag) setDrag(toTable(e)); }}
          onPointerUp={(e) => { if (!drag) return; const p = toTable(e); setDrag(null); setS(putt(s, s.ball.x - p.x, s.ball.y - p.y)); }} />
        {s.done && (
          <div className="bb-over"><b>Round done: {t} strokes ({t - PAR > 0 ? "+" : ""}{t - PAR || "level"} vs par {PAR})</b><button className="btn btn-pink btn-sm" onClick={() => setS(newRound())}>Play again</button></div>
        )}
      </div>
      <table className="gl-card" aria-label="Scorecard"><tbody>
        <tr><th scope="row">Hole</th>{HOLES.map((_, i) => <td key={i}>{i + 1}</td>)}<td>Total</td></tr>
        <tr><th scope="row">Par</th>{HOLES.map((h, i) => <td key={i}>{h.par}</td>)}<td>{PAR}</td></tr>
        <tr><th scope="row">You</th>{HOLES.map((_, i) => <td key={i}>{i < s.hole || (i === s.hole && (s.sunk || s.done)) ? s.strokes[i] : ""}</td>)}<td>{t || ""}</td></tr>
      </tbody></table>
    </div>
  );
}
