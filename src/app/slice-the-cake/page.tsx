"use client";
import { useEffect, useRef, useState } from "react";
import ArcadeBoard from "@/components/ArcadeBoard";
import { EMOJI, HEIGHT, WIDTH, newState, step, swipe, type State } from "@/lib/sliceCake";
import { addFlag } from "@/lib/trophyFlags";
import { buzz } from "@/lib/gameSettings";

const BEST = "mm-slice-best";
type Trail = { x: number; y: number; at: number }[];

export default function SliceTheCake() {
  const [s, setS] = useState<State>(newState);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [best, setBest] = useState(0);
  const live = useRef(s), canvas = useRef<HTMLCanvasElement>(null), trail = useRef<Trail>([]), down = useRef(false);
  const halves = useRef<{ x: number; y: number; vx: number; vy: number; e: string; born: number }[]>([]);
  live.current = s;
  useEffect(() => { try { setBest(Number(localStorage.getItem(BEST)) || 0); } catch {} }, []);
  useEffect(() => {
    if (!playing || paused || s.over) return;
    let raf = 0, last = performance.now();
    const frame = (now: number) => {
      let dt = Math.min(0.05, (now - last) / 1000); last = now;
      let n = live.current;
      while (dt > 0 && !n.over) { const d = Math.min(dt, 1 / 120); n = step(n, d, Math.random); dt -= d; }
      live.current = n; setS(n);
      if (!n.over) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, paused, s.over]);
  useEffect(() => {
    if (!s.over) return;
    if (s.score >= 500) addFlag("slice-500");
    if (s.score > best) { setBest(s.score); try { localStorage.setItem(BEST, String(s.score)); } catch {} }
  }, [s.over]); // eslint-disable-line react-hooks/exhaustive-deps
  // Draw: the counter, the flying treats, sliced halves and the swipe
  useEffect(() => {
    const c = canvas.current, ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1, cw = c.clientWidth;
    if (c.width !== Math.round(cw * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(cw * dpr * (HEIGHT / WIDTH)); }
    const k = c.width / WIDTH, now = performance.now();
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, HEIGHT); g.addColorStop(0, "#6b4433"); g.addColorStop(1, "#3b2720");
    ctx.fillStyle = g; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = "rgba(255,255,255,0.05)"; for (let y = 30; y < HEIGHT; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); }
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const i of s.items) { if (i.sliced) continue; ctx.font = `${i.r * 2}px system-ui`; ctx.fillText(EMOJI[i.kind], i.x, i.y); }
    halves.current = halves.current.filter((h) => now - h.born < 700);
    for (const h of halves.current) {
      const a = (now - h.born) / 1000;
      ctx.globalAlpha = Math.max(0, 1 - a / 0.7); ctx.font = "34px system-ui";
      for (const side of [-1, 1]) {
        ctx.save(); ctx.translate(h.x + side * 60 * a + h.vx * a, h.y + h.vy * a + 450 * a * a); ctx.rotate(side * a * 3);
        ctx.beginPath(); ctx.rect(side < 0 ? -20 : 0, -20, 20, 40); ctx.clip(); ctx.fillText(h.e, 0, 0); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    const tr = trail.current.filter((p) => now - p.at < 160);
    if (tr.length > 1) {
      ctx.strokeStyle = "rgba(255,250,246,0.9)"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); tr.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    }
    ctx.fillStyle = "#fffaf6"; ctx.font = "bold 18px system-ui"; ctx.textAlign = "left"; ctx.fillText(String(s.score), 12, 20);
    ctx.textAlign = "right"; ctx.fillText("✕".repeat(s.misses) + "·".repeat(3 - s.misses), WIDTH - 12, 20);
  }, [s]);
  function toTable(e: React.PointerEvent<HTMLCanvasElement>) { const r = e.currentTarget.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * WIDTH, y: ((e.clientY - r.top) / r.height) * HEIGHT }; }
  function cut(e: React.PointerEvent<HTMLCanvasElement>, fresh: boolean) {
    const p = toTable(e), now = performance.now();
    let prev = trail.current[trail.current.length - 1];
    // A pause in the movement starts a new swipe (so a mouse that never "lifts" doesn't build one endless combo)
    if (prev && now - prev.at > 150) { fresh = true; prev = undefined as never; }
    trail.current = [...(fresh ? [] : trail.current.slice(-12)), { ...p, at: now }];
    if (fresh) live.current = { ...live.current, combo: 0 };
    if (!playing || paused || fresh || !prev) return;
    const r = swipe(live.current, prev.x, prev.y, p.x, p.y);
    if (r.sliced.length) {
      for (const i of r.sliced) halves.current.push({ x: i.x, y: i.y, vx: i.vx, vy: i.vy, e: EMOJI[i.kind], born: performance.now() });
      buzz(r.s.over ? [80, 40, 80] : 12);
      live.current = r.s; setS(r.s);
    }
  }
  function begin() { const n = newState(); live.current = n; setS(n); setPlaying(true); setPaused(false); halves.current = []; }
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "p" && playing) setPaused((x) => !x); };
    const hide = () => { if (document.hidden) setPaused(true); };
    window.addEventListener("keydown", h); document.addEventListener("visibilitychange", hide);
    return () => { window.removeEventListener("keydown", h); document.removeEventListener("visibilitychange", hide); };
  });
  return (
    <div className="page" style={{ maxWidth: "28rem" }}>
      <p className="eyebrow">an arcade game</p>
      <h1 className="h2">Slice the <em>cake</em></h1>
      <p className="small muted">Cakes and fruit get tossed up from the counter. Swipe through them before they fall: 10 a slice, and a bonus for three or more in one swipe. Drop three treats and it&apos;s over, and whatever you do, don&apos;t slice a chilli 🌶️.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>Score <b>{s.score}</b></span><span>Dropped <b>{s.misses}</b>/3</span><span>Best <b>{best}</b></span></div>
      <div className="bb-wrap">
        <canvas ref={canvas} className="bb-canvas" style={{ aspectRatio: `${WIDTH} / ${HEIGHT}`, touchAction: "none" }} role="img" aria-label={`Slice the cake, score ${s.score}`}
          onPointerDown={(e) => { down.current = true; e.currentTarget.setPointerCapture(e.pointerId); trail.current = []; cut(e, true); }}
          onPointerMove={(e) => { if (down.current || e.pointerType === "mouse") cut(e, false); }}
          onPointerUp={() => { down.current = false; }} onPointerLeave={() => { trail.current = []; }} />
        {(!playing || s.over || paused) && (
          <div className="bb-over">
            {s.over ? <><b>{s.reason} {s.score} points</b><button className="btn btn-pink btn-sm" onClick={begin}>Play again</button></>
              : paused ? <><b>Paused</b><button className="btn btn-pink btn-sm" onClick={() => setPaused(false)}>Carry on</button></>
              : <button className="btn btn-pink" onClick={begin}>▶ Start slicing</button>}
          </div>
        )}
      </div>
      <p className="tiny muted center">With a mouse, just sweep across; on a phone, swipe with a finger. P pauses.</p>
      <ArcadeBoard game="slice" score={s.score} over={s.over} />
    </div>
  );
}
