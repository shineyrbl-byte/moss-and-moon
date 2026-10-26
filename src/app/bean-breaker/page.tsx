"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { BALL_R, BRICK_H, H, PAD_H, PAD_Y, W, brickBox, launch, movePad, newGame, nextLevel, padW, step, type Power, type State } from "@/lib/breaker";
import { addFlag } from "@/lib/trophyFlags";

type Board = { top: { name: string; score: number }[]; mine: number | null; best: number | null };
const BEST = "mm-breaker-best";
const ICON: Record<Power, string> = { wide: "↔", slow: "🐢", life: "♥", multi: "✦" };
const ROWS = ["#c25b78", "#e391a8", "#b97f52", "#e6cfbd", "#9fae8d", "#f6da9e"];

export default function BeanBreaker() {
  const { toast } = useStore();
  const [s, setS] = useState<State>(newGame);
  const [paused, setPaused] = useState(false);
  const [best, setBest] = useState(0);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef(s);
  const keys = useRef({ left: false, right: false });
  live.current = s;
  useEffect(() => {
    try { setBest(Number(localStorage.getItem(BEST)) || 0); setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    fetch(`/api/arcade?game=breaker&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);

  // The game loop: small fixed steps so a fast bean can't skip through a cube
  useEffect(() => {
    if (paused || s.over || s.cleared) return;
    let raf = 0, last = performance.now();
    const frame = (t: number) => {
      let dt = Math.min(0.05, (t - last) / 1000); last = t;
      let n = live.current;
      const k = keys.current;
      if (k.left !== k.right) n = movePad(n, n.pad + (k.right ? 1 : -1) * 95 * dt);
      while (dt > 0) { const d = Math.min(dt, 1 / 120); n = step(n, d); dt -= d; }
      live.current = n; setS(n);
      if (!n.over && !n.cleared) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [paused, s.over, s.cleared, s.stuck]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (s.cleared) {
      addFlag("breaker-wall");
      toast(`Wall ${s.level} cleared! +${100 * s.level} 🧱`);
    }
    if (s.over && s.score > best) { setBest(s.score); try { localStorage.setItem(BEST, String(s.score)); } catch {} toast(`New best: ${s.score}! 🫘`); }
  }, [s.cleared, s.over]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draw
  useEffect(() => {
    const c = canvas.current, ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const css = getComputedStyle(document.documentElement);
    const v = (n: string) => css.getPropertyValue(n).trim();
    const dpr = window.devicePixelRatio || 1, cw = c.clientWidth;
    if (c.width !== Math.round(cw * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(cw * dpr * (H / W)); }
    const k = c.width / W;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = v("--surface-2"); ctx.fillRect(0, 0, W, H);
    for (const b of s.bricks) {
      const x = brickBox(b);
      ctx.fillStyle = ROWS[b.r % ROWS.length];
      ctx.beginPath(); ctx.roundRect(x.x, x.y, x.w, x.h, 1.2); ctx.fill();
      if (b.hp > 1) { ctx.strokeStyle = v("--text"); ctx.lineWidth = 0.6; ctx.stroke(); }
      ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(x.x + 1, x.y + 0.8, x.w - 2, BRICK_H * 0.22);
    }
    ctx.font = "5px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const d of s.drops) { ctx.fillStyle = v("--pink-fill"); ctx.beginPath(); ctx.arc(d.x, d.y, 3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = v("--on-pink"); ctx.fillText(ICON[d.kind], d.x, d.y + 0.3); }
    const w = padW(s);
    ctx.fillStyle = v("--brown"); ctx.beginPath(); ctx.roundRect(s.pad - w / 2, PAD_Y, w, PAD_H, 1.5); ctx.fill();
    ctx.fillStyle = v("--latte"); ctx.beginPath(); ctx.ellipse(s.pad, PAD_Y + 0.6, w / 2 - 2, 0.8, 0, 0, Math.PI * 2); ctx.fill();
    for (const b of s.balls) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(0.6);
      ctx.fillStyle = "#5a3424"; ctx.beginPath(); ctx.ellipse(0, 0, BALL_R * 1.15, BALL_R * 0.85, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#c9925f"; ctx.lineWidth = 0.35; ctx.beginPath(); ctx.moveTo(-BALL_R * 0.8, 0); ctx.quadraticCurveTo(0, 0.6, BALL_R * 0.8, 0); ctx.stroke();
      ctx.restore();
    }
  }, [s]);

  function begin() { const n = newGame(); live.current = n; setS(n); setSaved(false); setPaused(false); }
  function go() {
    const n = live.current;
    if (n.over) return begin();
    if (n.cleared) { const m = nextLevel(n); live.current = m; return setS(m); }
    if (n.stuck) { const m = launch(n); live.current = m; setS(m); setPaused(false); }
  }
  function aim(e: React.PointerEvent) {
    const c = canvas.current;
    if (!c || paused) return;
    const box = c.getBoundingClientRect();
    const n = movePad(live.current, ((e.clientX - box.left) / box.width) * W);
    live.current = n; setS(n);
  }
  useEffect(() => {
    const set = (e: KeyboardEvent, on: boolean) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "ArrowLeft" || e.key === "a") { keys.current.left = on; e.preventDefault(); }
      else if (e.key === "ArrowRight" || e.key === "d") { keys.current.right = on; e.preventDefault(); }
      else if (on && (e.key === " " || e.key === "Enter") && (e.target as HTMLElement).tagName !== "BUTTON") { e.preventDefault(); go(); }
      else if (on && e.key === "p") setPaused((p) => !p);
    };
    const down = (e: KeyboardEvent) => set(e, true), up = (e: KeyboardEvent) => set(e, false);
    const hide = () => { if (document.hidden) setPaused(true); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); document.addEventListener("visibilitychange", hide);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); document.removeEventListener("visibilitychange", hide); };
  });
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/arcade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "breaker", score: s.score, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  const fresh = s.stuck && s.level === 1 && s.score === 0 && s.lives === 3;
  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">an arcade game</p>
      <h1 className="h2">Bean <em>breaker</em></h1>
      <p className="small muted">Bounce the coffee bean off the saucer to knock out the wall of sugar cubes. Where it lands on the saucer decides which way it flies. Catch the falling treats: ↔ a wider saucer, 🐢 a slower bean, ✦ two extra beans and ♥ another life.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}>
        <span>Score <b>{s.score}</b></span><span>Wall <b>{s.level}</b></span><span aria-label={`${s.lives} lives`}>{"♥".repeat(Math.max(0, s.lives))}</span><span>Best <b>{best}</b></span>
      </div>
      <div className="bb-wrap">
        <canvas ref={canvas} className="bb-canvas" onPointerMove={aim} onPointerDown={(e) => { aim(e); go(); }} role="img"
          aria-label={`Bean breaker: wall ${s.level}, ${s.bricks.length} sugar cubes left, ${s.lives} lives, score ${s.score}`} />
        {s.stuck && !fresh && !s.over && !paused && <p className="bb-tip" aria-live="polite">Tap or press space to launch</p>}
        {(fresh || s.over || s.cleared || paused) && (
          <div className="bb-over">
            {s.over ? <><b>Out of beans! {s.score} points</b><button className="btn btn-pink btn-sm" onClick={begin}>Play again</button></>
              : s.cleared ? <><b>Wall {s.level} cleared 🎉</b><button className="btn btn-pink btn-sm" onClick={go}>Next wall →</button></>
              : paused ? <><b>Paused</b><button className="btn btn-pink btn-sm" onClick={() => setPaused(false)}>Carry on</button></>
              : <button className="btn btn-pink" onClick={go}>▶ Launch the bean</button>}
          </div>
        )}
      </div>
      <div className="row" style={{ justifyContent: "center", gap: "0.5rem", marginTop: "0.6rem" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setPaused(!paused)} disabled={s.over || s.cleared || s.stuck}>{paused ? "▶ Carry on" : "⏸ Pause"}</button>
      </div>
      {s.over && s.score > 0 && !saved && (
        <div className="row" style={{ justifyContent: "center", alignItems: "end", gap: "0.5rem", marginTop: "0.6rem" }}>
          <label className="field" style={{ maxWidth: "12rem", marginBottom: 0 }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
          <button className="btn btn-pink btn-sm" onClick={save}>Save score</button>
        </div>
      )}
      {saved && <p className="small center">Saved ✓</p>}
      <p className="tiny muted center">Slide your finger or mouse over the table to move the saucer, and tap to launch. Keys: ← → (or A and D) to move, space to launch, P to pause. It pauses when you switch tabs.</p>
      {board && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">This week&apos;s best</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{t.score}</b></li>)}</ol> : <p className="small muted">No scores yet this week. Set the first one.</p>}
          <p className="tiny muted">The board starts fresh every Monday.</p>
        </section>
      )}
    </div>
  );
}
