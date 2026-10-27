"use client";
import { useEffect, useRef, useState } from "react";
import { GOAL, H, MALLET_R, PUCK_R, TARGET, W, clampMallet, computerMallet, newGame, step, type State, type V } from "@/lib/airHockey";
import { addFlag } from "@/lib/trophyFlags";
import { buzz } from "@/lib/gameSettings";

const STATS = "mm-hockey";

export default function AirHockey() {
  const [mode, setMode] = useState<"computer" | "two">("computer");
  const [level, setLevel] = useState<"easy" | "hard">("easy");
  const [s, setS] = useState<State>(newGame);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rec, setRec] = useState({ won: 0, lost: 0 });
  const live = useRef(s), want = useRef<[V, V]>([s.mallets[0], s.mallets[1]]), canvas = useRef<HTMLCanvasElement>(null);
  const touches = useRef(new Map<number, 0 | 1>());
  live.current = s;
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (v) setRec(v); } catch {} }, []);
  useEffect(() => {
    if (!playing || paused || s.over) return;
    let raf = 0, last = performance.now();
    const frame = (t: number) => {
      const dt = Math.min(0.033, (t - last) / 1000); last = t;
      let n = live.current;
      const m1 = mode === "computer" ? computerMallet(n, level, dt) : want.current[1];
      const r = step(n, dt, [want.current[0], m1]);
      n = r.s;
      if (mode === "computer") want.current[1] = n.mallets[1];
      if (r.hit) buzz(8);
      if (r.goal !== null) buzz([40, 30, 40]);
      live.current = n; setS(n);
      if (!n.over) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, paused, s.over, mode, level]);
  useEffect(() => {
    if (!s.over || mode !== "computer") return;
    const won = s.score[0] > s.score[1];
    if (won) addFlag(level === "hard" ? "hockey-hard" : "hockey-win");
    const next = { won: rec.won + (won ? 1 : 0), lost: rec.lost + (won ? 0 : 1) };
    setRec(next); try { localStorage.setItem(STATS, JSON.stringify(next)); } catch {}
  }, [s.over]); // eslint-disable-line react-hooks/exhaustive-deps
  const toTable = (x: number, y: number) => { const r = canvas.current!.getBoundingClientRect(); return { x: ((x - r.left) / r.width) * W, y: ((y - r.top) / r.height) * H }; };
  function point(e: React.PointerEvent, up = false) {
    const p = toTable(e.clientX, e.clientY);
    if (up) { touches.current.delete(e.pointerId); return; }
    // Each finger works the mallet on the half it started in
    let who = touches.current.get(e.pointerId);
    if (who === undefined) { who = mode === "computer" || p.y > H / 2 ? 0 : 1; touches.current.set(e.pointerId, who); }
    want.current[who] = clampMallet(p, who);
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "p") setPaused((x) => !x); };
    const hide = () => { if (document.hidden) setPaused(true); };
    window.addEventListener("keydown", h); document.addEventListener("visibilitychange", hide);
    return () => { window.removeEventListener("keydown", h); document.removeEventListener("visibilitychange", hide); };
  });
  // Draw
  useEffect(() => {
    const c = canvas.current, ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1, cw = c.clientWidth;
    if (c.width !== Math.round(cw * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(cw * dpr * (H / W)); }
    const k = c.width / W;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = "#f3e6d8"; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#e391a8"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 46, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#3b2720"; ctx.fillRect(W / 2 - GOAL / 2, 0, GOAL, 6); ctx.fillRect(W / 2 - GOAL / 2, H - 6, GOAL, 6);
    ctx.font = "bold 40px system-ui"; ctx.textAlign = "center"; ctx.fillStyle = "rgba(59,39,32,0.18)";
    ctx.fillText(String(s.score[1]), W / 2, H / 2 - 30); ctx.fillText(String(s.score[0]), W / 2 + 0, H / 2 + 62);
    ctx.fillStyle = "#3b2720"; ctx.beginPath(); ctx.arc(s.puck.x, s.puck.y, PUCK_R, 0, Math.PI * 2); ctx.fill();
    for (const who of [0, 1] as const) {
      const m = s.mallets[who];
      ctx.fillStyle = who === 0 ? "#c25b78" : "#8a5a40"; ctx.beginPath(); ctx.arc(m.x, m.y, MALLET_R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.arc(m.x, m.y, MALLET_R * 0.45, 0, Math.PI * 2); ctx.fill();
    }
  }, [s]);
  function begin(m = mode, lv = level) { setMode(m); setLevel(lv); const n = newGame(); live.current = n; want.current = [n.mallets[0], n.mallets[1]]; setS(n); setPlaying(true); setPaused(false); }
  const winner = s.over ? (s.score[0] > s.score[1] ? (mode === "computer" ? "You win" : "Pink wins") : mode === "computer" ? "The computer wins" : "Brown wins") : "";
  return (
    <div className="page" style={{ maxWidth: "26rem" }}>
      <p className="eyebrow">a game</p>
      <h1 className="h2">Air <em>hockey</em></h1>
      <p className="small muted">Knock the puck into the other goal. First to {TARGET}. Play the computer, or two of you on one phone or tablet: each holds the mallet on their own half.</p>
      <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
        <button className={`chip ${mode === "computer" && level === "easy" ? "on" : ""}`} onClick={() => begin("computer", "easy")}>vs computer (easy)</button>
        <button className={`chip ${mode === "computer" && level === "hard" ? "on" : ""}`} onClick={() => begin("computer", "hard")}>vs computer (hard)</button>
        <button className={`chip ${mode === "two" ? "on" : ""}`} onClick={() => begin("two")}>👥 Two players</button>
      </div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>{mode === "computer" ? "You" : "Pink"} <b>{s.score[0]}</b></span><span><b>{s.score[1]}</b> {mode === "computer" ? "Computer" : "Brown"}</span></div>
      <div className="bb-wrap">
        <canvas ref={canvas} className="bb-canvas" style={{ aspectRatio: `${W} / ${H}`, touchAction: "none" }} role="img" aria-label={`Air hockey, ${s.score[0]} to ${s.score[1]}`}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); point(e); }} onPointerMove={(e) => point(e)} onPointerUp={(e) => point(e, true)} onPointerCancel={(e) => point(e, true)} />
        {(!playing || s.over || paused) && (
          <div className="bb-over">
            {s.over ? <><b>{winner}, {Math.max(...s.score)} to {Math.min(...s.score)}!</b><button className="btn btn-pink btn-sm" onClick={() => begin()}>Play again</button></>
              : paused ? <><b>Paused</b><button className="btn btn-pink btn-sm" onClick={() => setPaused(false)}>Carry on</button></>
              : <button className="btn btn-pink" onClick={() => begin()}>▶ Face off</button>}
          </div>
        )}
      </div>
      <p className="small muted" style={{ marginTop: "0.8rem" }}>Against the computer: won {rec.won} · lost {rec.lost}. Your mallet is pink, at the bottom. P pauses.</p>
    </div>
  );
}
