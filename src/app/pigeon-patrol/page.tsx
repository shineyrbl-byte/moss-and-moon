"use client";
import { useEffect, useRef, useState } from "react";
import ArcadeBoard from "@/components/ArcadeBoard";
import { H, SHIP_W, SHIP_Y, W, birdBox, fire, moveShip, newGame, step, type State } from "@/lib/pigeons";
import { addFlag } from "@/lib/trophyFlags";

const BEST = "mm-pigeons-best";

export default function PigeonPatrol() {
  const [s, setS] = useState<State>(newGame);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [best, setBest] = useState(0);
  const live = useRef(s), canvas = useRef<HTMLCanvasElement>(null), keys = useRef({ l: false, r: false, fire: false });
  live.current = s;
  useEffect(() => { try { setBest(Number(localStorage.getItem(BEST)) || 0); } catch {} }, []);
  useEffect(() => {
    if (!playing || paused || s.over) return;
    let raf = 0, last = performance.now();
    const frame = (t: number) => {
      let dt = Math.min(0.05, (t - last) / 1000); last = t;
      let n = live.current;
      const k = keys.current;
      if (k.l !== k.r) n = moveShip(n, n.ship + (k.r ? 1 : -1) * 80 * dt);
      if (k.fire) n = fire(n);
      while (dt > 0 && !n.over) { const d = Math.min(dt, 1 / 120); n = step(n, d); dt -= d; }
      live.current = n; setS(n);
      if (!n.over) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, paused, s.over]);
  useEffect(() => {
    if (!s.over) return;
    if (s.wave >= 3) addFlag("pigeons-wave3");
    if (s.score > best) { setBest(s.score); try { localStorage.setItem(BEST, String(s.score)); } catch {} }
  }, [s.over]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const c = canvas.current, ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const css = getComputedStyle(document.documentElement), v = (n: string) => css.getPropertyValue(n).trim();
    const dpr = window.devicePixelRatio || 1, cw = c.clientWidth;
    if (c.width !== Math.round(cw * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(cw * dpr * (H / W)); }
    const k = c.width / W;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = v("--surface-2"); ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "7px system-ui";
    for (const b of s.birds) { if (!b.alive) continue; const x = birdBox(s, b); ctx.fillText("🐦", x.x + x.w / 2, x.y + x.h / 2); }
    ctx.fillStyle = "#5a3424"; for (const sh of s.shots) { ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 1, 1.6, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#e8b86a"; for (const c2 of s.crumbs) { ctx.fillRect(c2.x - 1, c2.y - 1, 2, 2); }
    if (!(s.hitFor > 0 && Math.floor(s.hitFor * 10) % 2)) {
      ctx.fillStyle = v("--brown"); ctx.beginPath(); ctx.ellipse(s.ship, SHIP_Y + 2, SHIP_W / 2, 2.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = v("--pink"); ctx.fillRect(s.ship - 2.5, SHIP_Y - 3, 5, 4);
    }
  }, [s]);
  function begin() { const n = newGame(); live.current = n; setS(n); setPlaying(true); setPaused(false); }
  function aim(e: React.PointerEvent) { const c = canvas.current; if (!c || !playing) return; const box = c.getBoundingClientRect(); const n = moveShip(live.current, ((e.clientX - box.left) / box.width) * W); live.current = n; setS(n); }
  useEffect(() => {
    const set = (e: KeyboardEvent, on: boolean) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "ArrowLeft" || e.key === "a") { keys.current.l = on; e.preventDefault(); }
      else if (e.key === "ArrowRight" || e.key === "d") { keys.current.r = on; e.preventDefault(); }
      else if (e.key === " ") { if ((e.target as HTMLElement).tagName === "BUTTON") return; e.preventDefault(); if (!playing || live.current.over) { if (on) begin(); } else keys.current.fire = on; }
      else if (on && e.key === "p" && playing) setPaused((x) => !x);
    };
    const down = (e: KeyboardEvent) => set(e, true), up = (e: KeyboardEvent) => set(e, false);
    const hide = () => { if (document.hidden) setPaused(true); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); document.addEventListener("visibilitychange", hide);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); document.removeEventListener("visibilitychange", hide); };
  });
  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">an arcade game</p>
      <h1 className="h2">Pigeon <em>patrol</em></h1>
      <p className="small muted">A flock of pigeons is marching down on the terrace tables. Slide the saucer and flick coffee beans up to shoo them off, and dodge the crumbs they drop. Clear the flock and a quicker one arrives.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>Score <b>{s.score}</b></span><span>Wave <b>{s.wave}</b></span><span aria-label={`${s.lives} lives`}>{"♥".repeat(Math.max(0, s.lives))}</span><span>Best <b>{best}</b></span></div>
      <div className="bb-wrap">
        <canvas ref={canvas} className="bb-canvas" style={{ aspectRatio: `${W} / ${H}` }} onPointerMove={aim}
          onPointerDown={(e) => { aim(e); keys.current.fire = true; }} onPointerUp={() => { keys.current.fire = false; }} onPointerLeave={() => { keys.current.fire = false; }}
          role="img" aria-label={`Pigeon patrol: wave ${s.wave}, ${s.birds.filter((b) => b.alive).length} pigeons left, score ${s.score}`} />
        {(!playing || s.over || paused) && (
          <div className="bb-over">
            {s.over ? <><b>The pigeons won this time. {s.score} points</b><button className="btn btn-pink btn-sm" onClick={begin}>Play again</button></>
              : paused ? <><b>Paused</b><button className="btn btn-pink btn-sm" onClick={() => setPaused(false)}>Carry on</button></>
              : <button className="btn btn-pink" onClick={begin}>▶ Start the patrol</button>}
          </div>
        )}
      </div>
      <p className="tiny muted center">Slide your finger or mouse to move, and hold it down to keep flicking beans. Keys: ← → to move, space to flick, P to pause.</p>
      <ArcadeBoard game="pigeons" score={s.score} over={s.over} />
    </div>
  );
}
