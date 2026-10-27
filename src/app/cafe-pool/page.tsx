"use client";
import { useEffect, useRef, useState } from "react";
import { COLOURS, H, POCKETS, POCKET_R, R, W, computerShot, groupName, newGame, step, strike, type State } from "@/lib/pool";
import { addFlag } from "@/lib/trophyFlags";

const STATS = "mm-pool";
type Level = "easy" | "hard";

export default function CafePool() {
  const [level, setLevel] = useState<Level>("easy");
  const [s, setS] = useState<State>(newGame);
  const [aim, setAim] = useState<{ x: number; y: number } | null>(null);
  const [stats, setStats] = useState<Record<Level, { won: number; lost: number }>>({ easy: { won: 0, lost: 0 }, hard: { won: 0, lost: 0 } });
  const [recorded, setRecorded] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null), live = useRef(s);
  live.current = s;
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (v) setStats({ easy: { won: 0, lost: 0 }, hard: { won: 0, lost: 0 }, ...v }); } catch {} }, []);
  useEffect(() => {
    if (!s.moving) return;
    let raf = 0, last = performance.now();
    const frame = (t: number) => { const dt = Math.min(0.04, (t - last) / 1000); last = t; const n = step(live.current, dt); live.current = n; setS(n); if (n.moving) raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [s.moving]);
  // The computer's turn: think, then shoot
  useEffect(() => {
    if (s.moving || s.turn !== 1 || s.winner !== null) return;
    const id = setTimeout(() => { const sh = computerShot(live.current, level, Math.random); setS(strike(live.current, sh.angle, sh.power)); }, 900);
    return () => clearTimeout(id);
  }, [s.moving, s.turn, s.winner, level]);
  useEffect(() => {
    if (s.winner === null || recorded) return;
    setRecorded(true);
    const won = s.winner === 0;
    if (won) addFlag(level === "hard" ? "pool-hard" : "pool-win");
    const next = { ...stats, [level]: { won: stats[level].won + (won ? 1 : 0), lost: stats[level].lost + (won ? 0 : 1) } };
    setStats(next); try { localStorage.setItem(STATS, JSON.stringify(next)); } catch {}
  }, [s.winner]); // eslint-disable-line react-hooks/exhaustive-deps
  const cue = s.balls.find((b) => b.n === 0)!;
  const myTurn = s.turn === 0 && !s.moving && s.winner === null;
  const toTable = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; };
  // Draw
  useEffect(() => {
    const c = canvas.current, ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1, cw = c.clientWidth;
    if (c.width !== Math.round(cw * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(cw * dpr * (H / W)); }
    const k = c.width / W;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = "#6b4433"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#4f7a55"; ctx.fillRect(12, 12, W - 24, H - 24);
    ctx.fillStyle = "#1e130f"; for (const [px, py] of POCKETS) { ctx.beginPath(); ctx.arc(px, py, POCKET_R, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.beginPath(); ctx.moveTo(14, H * 0.78); ctx.lineTo(W - 14, H * 0.78); ctx.stroke();
    for (const b of s.balls) {
      if (b.down) continue;
      ctx.fillStyle = COLOURS[b.n]; ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, Math.PI * 2); ctx.fill();
      if (b.n >= 9) { ctx.fillStyle = "#fffaf6"; ctx.fillRect(b.x - R, b.y - 2.5, R * 2, 5); ctx.fillStyle = COLOURS[b.n]; ctx.beginPath(); ctx.arc(b.x, b.y, R * 0.45, 0, Math.PI * 2); ctx.fill(); }
      if (b.n > 0) { ctx.fillStyle = b.n === 8 ? "#fffaf6" : "#2b1d18"; ctx.font = "bold 6px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(b.n), b.x, b.y + 0.5); }
    }
    if (aim && myTurn) {
      // Drag back from the white: the cue line points the way it'll go
      const dx = cue.x - aim.x, dy = cue.y - aim.y, len = Math.min(140, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
      ctx.setLineDash([4, 4]); ctx.strokeStyle = "rgba(255,250,246,0.7)"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(cue.x, cue.y); ctx.lineTo(cue.x + Math.cos(a) * 160, cue.y + Math.sin(a) * 160); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = "#e8b86a"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cue.x - Math.cos(a) * (R + 4), cue.y - Math.sin(a) * (R + 4)); ctx.lineTo(cue.x - Math.cos(a) * (R + 4 + len), cue.y - Math.sin(a) * (R + 4 + len)); ctx.stroke();
    }
  }, [s, aim, myTurn, cue]);
  function newGame2(lv = level) {
    if (s.winner === null && s.balls.some((b) => b.down)) { const next = { ...stats, [level]: { ...stats[level], lost: stats[level].lost + 1 } }; setStats(next); try { localStorage.setItem(STATS, JSON.stringify(next)); } catch {} }
    setLevel(lv); setS(newGame()); setRecorded(false);
  }
  const left = (n: number) => s.balls.filter((b) => !b.down && (n === 0 ? b.n >= 1 && b.n <= 7 : b.n >= 9)).length;
  return (
    <div className="page" style={{ maxWidth: "26rem" }}>
      <p className="eyebrow">a game</p>
      <h1 className="h2">Café <em>pool</em></h1>
      <p className="small muted">Eight-ball against the computer. Your first pot decides your group, spots (1–7) or stripes (9–15). Pot your own and you go again; pot all of yours, then the black 8 to win. A foul (the white going down, or hitting the wrong ball first) gives the other player the shot, with the white back on its spot. Drag back from the white to aim and set the power.</p>
      <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
        {(["easy", "hard"] as const).map((lv) => <button key={lv} className={`chip ${level === lv ? "on" : ""}`} onClick={() => lv !== level && newGame2(lv)}>{lv === "easy" ? "Easy" : "Hard"}</button>)}
        <button className="btn btn-ghost btn-sm" onClick={() => newGame2()}>New game</button>
      </div>
      <p className="center small" aria-live="polite" style={{ margin: "0.5rem 0" }}>
        <b>{s.winner !== null ? (s.winner === 0 ? "You win! 🎱🎉" : "The computer wins") : s.moving ? "Rolling…" : s.turn === 0 ? "Your shot" : "The computer is lining up…"}</b>
        {" · "}You: {groupName(s.groups[0])}{s.groups[0] ? ` (${s.groups[0] === "spots" ? left(0) : left(1)} left)` : ""}
      </p>
      {s.message && <p className="center tiny muted" style={{ margin: "0 0 0.4rem" }}>{s.message}</p>}
      <div className="bb-wrap">
        <canvas ref={canvas} className="bb-canvas" style={{ aspectRatio: `${W} / ${H}`, touchAction: "none" }} role="img" aria-label={`Pool table. ${s.balls.filter((b) => !b.down && b.n).length} balls left.`}
          onPointerDown={(e) => { if (myTurn) { e.currentTarget.setPointerCapture(e.pointerId); setAim(toTable(e)); } }}
          onPointerMove={(e) => { if (aim) setAim(toTable(e)); }}
          onPointerUp={(e) => { if (!aim) return; const p = toTable(e); setAim(null); const dx = cue.x - p.x, dy = cue.y - p.y, len = Math.hypot(dx, dy); if (len > 8 && myTurn) setS(strike(s, Math.atan2(dy, dx), Math.min(1, len / 140))); }} />
        {s.winner !== null && <div className="bb-over"><b>{s.winner === 0 ? "You sank the black! 🎱" : "The computer took this one."}</b><button className="btn btn-pink btn-sm" onClick={() => newGame2()}>Play again</button></div>}
      </div>
      <p className="small muted" style={{ marginTop: "0.8rem" }}>On {level}: won {stats[level].won} · lost {stats[level].lost}</p>
    </div>
  );
}
