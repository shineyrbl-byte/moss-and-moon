"use client";
import "./page.css";
import { useEffect, useRef, useState } from "react";
import ArcadeBoard from "@/components/ArcadeBoard";
import { COLS, PATH, PASTRIES, ROWS, TOWERS, antXY, build, canBuild, newGame, sell, step, type Kind, type State } from "@/lib/pastryDefence";
import { addFlag } from "@/lib/trophyFlags";

const BEST = "mm-defence-best";
const onPath = new Set(PATH.map(([x, y]) => y * COLS + x));

export default function PastryDefence() {
  const [s, setS] = useState<State>(newGame);
  const [kind, setKind] = useState<Kind>("cannon");
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [fast, setFast] = useState(false);
  const [best, setBest] = useState(0);
  const live = useRef(s);
  live.current = s;
  useEffect(() => { try { setBest(Number(localStorage.getItem(BEST)) || 0); } catch {} }, []);
  useEffect(() => {
    if (!playing || paused || s.over) return;
    let raf = 0, last = performance.now();
    const frame = (t: number) => {
      let dt = Math.min(0.05, (t - last) / 1000) * (fast ? 2 : 1); last = t;
      let n = live.current;
      while (dt > 0 && !n.over) { const d = Math.min(dt, 1 / 30); n = step(n, d); dt -= d; }
      live.current = n; setS(n);
      if (!n.over) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, paused, s.over, fast]);
  useEffect(() => {
    if (s.wave >= 15) addFlag("defence-15");
    if (s.over && s.score > best) { setBest(s.score); try { localStorage.setItem(BEST, String(s.score)); } catch {} }
  }, [s.over, s.wave]); // eslint-disable-line react-hooks/exhaustive-deps
  function tap(at: number) {
    const cur = live.current;
    if (cur.towers.some((t) => t.at === at)) { const n = sell(cur, at); live.current = n; setS(n); return; }
    const n = build(cur, at, kind);
    if (n) { live.current = n; setS(n); }
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "p" && playing) setPaused((x) => !x); };
    const hide = () => { if (document.hidden) setPaused(true); };
    window.addEventListener("keydown", h); document.addEventListener("visibilitychange", hide);
    return () => { window.removeEventListener("keydown", h); document.removeEventListener("visibilitychange", hide); };
  });
  const begin = () => { const n = newGame(); live.current = n; setS(n); setPlaying(true); setPaused(false); };
  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">an arcade game</p>
      <h1 className="h2">Pastry <em>defence</em></h1>
      <p className="small muted">The ants are coming for the pastry case! Put helpers beside the path to stop them. Each ant that gets through eats a pastry (the big beetle every fifth wave eats three). Lose all {PASTRIES} and it&apos;s over. Tap a helper to sell it back for half.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center", flexWrap: "wrap" }}><span>Wave <b>{s.wave}</b></span><span>🪙 <b>{s.coins}</b></span><span>🥐 <b>{s.pastries}</b></span><span>Score <b>{s.score}</b></span><span>Best <b>{best}</b></span></div>
      <div className="pd-shop" role="group" aria-label="Helpers">
        {(Object.keys(TOWERS) as Kind[]).map((k) => <button key={k} className={`chip ${kind === k ? "on" : ""}`} aria-pressed={kind === k} onClick={() => setKind(k)} disabled={s.coins < TOWERS[k].cost && kind !== k}>{TOWERS[k].emoji} {TOWERS[k].name} · {TOWERS[k].cost}</button>)}
        <button className={`chip ${fast ? "on" : ""}`} onClick={() => setFast(!fast)} aria-pressed={fast}>⏩ Fast</button>
      </div>
      <div className="bb-wrap">
        <div className="pd-field" style={{ ["--c" as string]: COLS, ["--r" as string]: ROWS }} role="group" data-grid="" aria-label={`Wave ${s.wave}, ${s.ants.length} ants on the path, ${s.pastries} pastries left`}>
          {[...Array(COLS * ROWS).keys()].map((i) => {
            const t = s.towers.find((x) => x.at === i), path = onPath.has(i), end = i === PATH[PATH.length - 1][1] * COLS + PATH[PATH.length - 1][0];
            return <button key={i} className={`pd-sq ${path ? "path" : ""} ${!path && !t && canBuild(s, i, kind) ? "can" : ""}`} onClick={() => !path && tap(i)} disabled={path} aria-label={path ? "Path" : t ? `${TOWERS[t.kind].name}: tap to sell` : "Empty: tap to build"}>{end ? "🥐" : t ? TOWERS[t.kind].emoji : ""}</button>;
          })}
          {s.ants.map((a) => { const [x, y] = antXY(a.d); return <span key={a.id} className={`pd-ant ${a.big ? "big" : ""}`} style={{ left: `${(x / COLS) * 100}%`, top: `${(y / ROWS) * 100}%` }} aria-hidden="true">{a.big ? "🪲" : "🐜"}<i style={{ width: `${(a.hp / a.max) * 100}%` }} /></span>; })}
          {s.shots.map((sh, k) => { const fx = (sh.from % COLS) + 0.5, fy = Math.floor(sh.from / COLS) + 0.5; return <svg key={k} className="pd-shot" viewBox={`0 0 ${COLS} ${ROWS}`} preserveAspectRatio="none" aria-hidden="true"><line x1={fx} y1={fy} x2={sh.x} y2={sh.y} /></svg>; })}
        </div>
        {(!playing || s.over || paused) && (
          <div className="bb-over">
            {s.over ? <><b>The ants got the pastries! Wave {s.wave}, {s.score} points</b><button className="btn btn-pink btn-sm" onClick={begin}>Try again</button></>
              : paused ? <><b>Paused</b><button className="btn btn-pink btn-sm" onClick={() => setPaused(false)}>Carry on</button></>
              : <button className="btn btn-pink" onClick={begin}>▶ Open the café</button>}
          </div>
        )}
      </div>
      <p className="tiny muted center">🌀 steady shots · 🧂 slows ants down · ☕ one big hit, slow to reload. P pauses.</p>
      <ArcadeBoard game="defence" score={s.score} over={s.over} />
    </div>
  );
}
