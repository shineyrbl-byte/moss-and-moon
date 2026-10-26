"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { DUCK_H, H, RIDER_H, RIDER_W, RIDER_X, W, duck, jump, newGame, onGround, score, step, type State } from "@/lib/dash";
import { addFlag } from "@/lib/trophyFlags";

type Board = { top: { name: string; score: number }[]; mine: number | null; best: number | null };
const BEST = "mm-dash-best";
const GROUND = 8; // street height on screen, in world units
const HIT: Record<string, string> = { puddle: "Splash! Straight into a puddle.", crate: "Bump! You hit a crate.", awning: "Ouch! Mind the awning." };

export default function DeliveryDash() {
  const { toast } = useStore();
  const [s, setS] = useState<State>(newGame);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [best, setBest] = useState(0);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef(s);
  const swipe = useRef<{ y: number } | null>(null);
  live.current = s;
  useEffect(() => {
    try { setBest(Number(localStorage.getItem(BEST)) || 0); setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    fetch(`/api/arcade?game=dash&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
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
    if (!s.over || !playing) return;
    const sc = score(s);
    toast(HIT[s.hit ?? ""] ?? "Crash!");
    if (sc >= 1000) addFlag("dash-1000");
    if (sc > best) { setBest(sc); try { localStorage.setItem(BEST, String(sc)); } catch {} }
  }, [s.over]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draw the street
  useEffect(() => {
    const c = canvas.current, ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const css = getComputedStyle(document.documentElement), v = (n: string) => css.getPropertyValue(n).trim();
    const dpr = window.devicePixelRatio || 1, cw = c.clientWidth;
    if (c.width !== Math.round(cw * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(cw * dpr * ((H + GROUND) / W)); }
    const k = c.width / W;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const Y = (y: number) => H - y; // world y (up from the street) to canvas y
    ctx.fillStyle = v("--surface-2"); ctx.fillRect(0, 0, W, H + GROUND);
    // Shop fronts drifting past
    const off = (s.dist * 0.4) % 40;
    for (let x = -off; x < W + 40; x += 40) { ctx.fillStyle = v("--latte"); ctx.fillRect(x + 2, 10, 30, H - 10); ctx.fillStyle = v("--surface"); ctx.fillRect(x + 7, 18, 9, 11); ctx.fillRect(x + 20, 18, 9, 11); }
    ctx.fillStyle = v("--brown"); ctx.fillRect(0, H, W, GROUND);
    ctx.fillStyle = v("--latte");
    for (let x = -((s.dist) % 12); x < W; x += 12) ctx.fillRect(x, H + GROUND / 2 - 0.4, 6, 0.8);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const t of s.things) {
      if (t.kind === "puddle") { ctx.fillStyle = "#7fb2c9"; ctx.beginPath(); ctx.ellipse(t.x + t.w / 2, H - 0.2, t.w / 2, 1.4, 0, 0, Math.PI * 2); ctx.fill(); }
      else if (t.kind === "crate") { ctx.fillStyle = "#b97f52"; ctx.fillRect(t.x, Y(t.h), t.w, t.h); ctx.strokeStyle = "#6b4433"; ctx.lineWidth = 0.4; ctx.strokeRect(t.x, Y(t.h), t.w, t.h); ctx.beginPath(); ctx.moveTo(t.x, Y(t.h)); ctx.lineTo(t.x + t.w, H); ctx.stroke(); }
      else if (t.kind === "awning") {
        const top = 2, bottom = Y(t.y);
        for (let x = 0; x < t.w; x += 3) { ctx.fillStyle = (x / 3) % 2 ? "#fff3e6" : "#e391a8"; ctx.fillRect(t.x + x, top, 3, bottom - top); }
        ctx.fillStyle = "#c25b78"; ctx.beginPath(); for (let x = 0; x <= t.w; x += 3) ctx.arc(t.x + x + 1.5, bottom, 1.5, 0, Math.PI); ctx.fill();
      } else { ctx.font = "3px system-ui"; ctx.fillText("🫘", t.x + t.w / 2, Y(t.y + t.h / 2)); }
    }
    const ducking = s.ducking && onGround(s), h = ducking ? DUCK_H : RIDER_H;
    ctx.font = `${ducking ? 7 : 9}px system-ui`;
    ctx.save(); ctx.translate(RIDER_X + RIDER_W / 2, Y(s.y + h / 2)); ctx.scale(-1, 1); ctx.fillText("🚴", 0, 0); ctx.restore();
  }, [s]);

  function begin() { const n = newGame(); live.current = n; setS(n); setSaved(false); setPaused(false); setPlaying(true); }
  function hop() { if (!playing || s.over) return begin(); const n = jump(live.current); live.current = n; setS(n); }
  function low(on: boolean) { if (!playing) return; const n = duck(live.current, on); live.current = n; setS(n); }
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT") return;
      if (e.key === " " || e.key === "ArrowUp" || e.key === "w") { if (tag === "BUTTON" && e.key === " ") return; e.preventDefault(); hop(); }
      else if (e.key === "ArrowDown" || e.key === "s") { e.preventDefault(); low(true); }
      else if (e.key === "p" && playing && !s.over) setPaused((p) => !p);
    };
    const up = (e: KeyboardEvent) => { if (e.key === "ArrowDown" || e.key === "s") low(false); };
    const hide = () => { if (document.hidden) setPaused(true); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); document.addEventListener("visibilitychange", hide);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); document.removeEventListener("visibilitychange", hide); };
  });
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/arcade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "dash", score: score(s), name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  const sc = score(s);
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">an arcade game</p>
      <h1 className="h2">Delivery <em>dash</em></h1>
      <p className="small muted">Ride the café bike down the street with the morning orders. Jump the puddles and crates, duck under the low shop awnings, and grab the beans on the way. The further you get, the faster it goes.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}>
        <span>Score <b>{sc}</b></span><span>{Math.floor(s.dist / 10)} m</span><span>🫘 <b>{s.beans}</b></span><span>Best <b>{best}</b></span>
      </div>
      <div className="dd-wrap">
        <canvas ref={canvas} className="dd-canvas" role="img" aria-label={`Delivery dash: ${Math.floor(s.dist / 10)} metres, ${s.beans} beans, score ${sc}`}
          onPointerDown={(e) => { swipe.current = { y: e.clientY }; }}
          onPointerMove={(e) => { if (swipe.current && e.clientY - swipe.current.y > 25) low(true); }}
          onPointerUp={(e) => { const st = swipe.current; swipe.current = null; if (st && e.clientY - st.y > 25) low(false); else hop(); }} />
        {(!playing || s.over || paused) && (
          <div className="bb-over">
            {s.over ? <><b>{HIT[s.hit ?? ""] ?? "Crash!"} {sc} points</b><button className="btn btn-pink btn-sm" onClick={begin}>Ride again</button></>
              : paused ? <><b>Paused</b><button className="btn btn-pink btn-sm" onClick={() => setPaused(false)}>Carry on</button></>
              : <button className="btn btn-pink" onClick={begin}>▶ Start riding</button>}
          </div>
        )}
      </div>
      <div className="row dd-pad">
        <button className="btn btn-ghost" onPointerDown={(e) => { e.preventDefault(); hop(); }} aria-label="Jump">⤒ Jump</button>
        <button className="btn btn-ghost" onPointerDown={(e) => { e.preventDefault(); low(true); }} onPointerUp={() => low(false)} onPointerLeave={() => low(false)} aria-label="Duck (hold)">⤓ Duck (hold)</button>
      </div>
      {s.over && sc > 0 && !saved && (
        <div className="row" style={{ justifyContent: "center", alignItems: "end", gap: "0.5rem", marginTop: "0.6rem" }}>
          <label className="field" style={{ maxWidth: "12rem", marginBottom: 0 }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
          <button className="btn btn-pink btn-sm" onClick={save}>Save score</button>
        </div>
      )}
      {saved && <p className="small center">Saved ✓</p>}
      <p className="tiny muted center">Tap the street (or press space or ↑) to jump; swipe down or hold ↓ to duck. Ducking in mid-air drops you down fast. P pauses, and it pauses itself when you switch tabs.</p>
      {board && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">This week&apos;s furthest</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{t.score}</b></li>)}</ol> : <p className="small muted">No rides yet this week. Set the first one.</p>}
          <p className="tiny muted">The board starts fresh every Monday.</p>
        </section>
      )}
    </div>
  );
}
