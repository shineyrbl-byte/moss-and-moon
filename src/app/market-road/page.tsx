"use client";
import "./page.css";
import { useEffect, useRef, useState } from "react";
import ArcadeBoard from "@/components/ArcadeBoard";
import { DOORS, ROWS, W, check, hop, lanes, newState, positions, type Dir, type State } from "@/lib/marketRoad";
import { addFlag } from "@/lib/trophyFlags";

const BEST = "mm-road-best";
const KEYS: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };

export default function MarketRoad() {
  const [s, setS] = useState<State>(() => newState());
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [best, setBest] = useState(0);
  const [bump, setBump] = useState(false);
  const live = useRef(s), clock = useRef(0), swipe = useRef<{ x: number; y: number } | null>(null);
  live.current = s;
  useEffect(() => { try { setBest(Number(localStorage.getItem(BEST)) || 0); } catch {} }, []);
  useEffect(() => {
    if (!playing || paused || s.over) return;
    let raf = 0, last = performance.now();
    const frame = (now: number) => {
      clock.current += Math.min(0.05, (now - last) / 1000); last = now;
      const r = check(live.current, clock.current);
      if (r.bumped) { live.current = r.s; setS(r.s); setBump(true); setTimeout(() => setBump(false), 350); }
      setT(clock.current);
      if (!r.s.over) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, paused, s.over]);
  useEffect(() => {
    if (s.level >= 3) addFlag("road-level3");
    if (s.over && s.score > best) { setBest(s.score); try { localStorage.setItem(BEST, String(s.score)); } catch {} }
  }, [s.over, s.level]); // eslint-disable-line react-hooks/exhaustive-deps
  function begin() { const n = newState(); clock.current = 0; live.current = n; setS(n); setPlaying(true); setPaused(false); }
  function go(d: Dir) {
    if (!playing || live.current.over) { begin(); return; }
    setPaused(false);
    const n = hop(live.current, d); const r = check(n, clock.current);
    live.current = r.s; setS(r.s);
    if (r.bumped) { setBump(true); setTimeout(() => setBump(false), 350); }
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      const d = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
      if (d) { e.preventDefault(); go(d); } else if (e.key === "p" && playing) setPaused((x) => !x);
    };
    const hide = () => { if (document.hidden) setPaused(true); };
    window.addEventListener("keydown", h); document.addEventListener("visibilitychange", hide);
    return () => { window.removeEventListener("keydown", h); document.removeEventListener("visibilitychange", hide); };
  });
  const L = lanes(s.level);
  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">an arcade game</p>
      <h1 className="h2">Cross the <em>market road</em></h1>
      <p className="small muted">Get from the bus stop to the café door across the busy market road. Dodge the scooters, autos and handcarts; the pavement in the middle is safe. Fill all four café doors to go up a level, where everything&apos;s quicker.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>Score <b>{s.score}</b></span><span>Level <b>{s.level}</b></span><span aria-label={`${s.lives} lives`}>{"♥".repeat(Math.max(0, s.lives))}</span><span>Best <b>{best}</b></span></div>
      <div className="bb-wrap">
        <div className={`mr-board ${bump ? "bump" : ""}`} style={{ ["--w" as string]: W, ["--rows" as string]: ROWS }} role="img" aria-label={`Market road, row ${ROWS - s.r} of ${ROWS}, ${s.lives} lives`}
          onPointerDown={(e) => { swipe.current = { x: e.clientX, y: e.clientY }; }}
          onPointerUp={(e) => {
            const st = swipe.current; swipe.current = null; if (!st) return;
            const dx = e.clientX - st.x, dy = e.clientY - st.y;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return go("up"); // a tap hops forward
            go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
          }}>
          {[...Array(ROWS).keys()].map((r) => (
            <div key={r} className={`mr-row ${r === 0 ? "cafe" : r === 5 || r === ROWS - 1 ? "pave" : r < 5 ? "market" : "road"}`}>
              {r === 0 && [...Array(W).keys()].map((c) => <span key={c} className={`mr-door ${DOORS.includes(c) ? "open" : ""}`} style={{ left: `${(c / W) * 100}%` }}>{DOORS.includes(c) ? (s.filled.includes(c) ? "☕" : "🚪") : "🌿"}</span>)}
              {L.filter((l) => l.row === r).flatMap((l) => positions(l, t).map((x, k) => (
                <span key={k} className="mr-thing" style={{ left: `${(x / W) * 100}%`, width: `${(l.len / W) * 100}%`, transform: l.speed < 0 ? "scaleX(1)" : "scaleX(-1)" }}>{l.kind}</span>
              )))}
              {s.r === r && <span className="mr-me" style={{ left: `${(s.c / W) * 100}%` }} aria-hidden="true">🚶</span>}
            </div>
          ))}
        </div>
        {(!playing || s.over || paused) && (
          <div className="bb-over">
            {s.over ? <><b>Bumped! {s.score} points</b><button className="btn btn-pink btn-sm" onClick={begin}>Try again</button></>
              : paused ? <><b>Paused</b><button className="btn btn-pink btn-sm" onClick={() => setPaused(false)}>Carry on</button></>
              : <button className="btn btn-pink" onClick={begin}>▶ Start crossing</button>}
          </div>
        )}
      </div>
      <div className="tp-pad" aria-label="Move">
        {(["up", "left", "down", "right"] as Dir[]).map((d) => <button key={d} className={`btn btn-ghost btn-sm ${d}`} onClick={() => go(d)} aria-label={d}>{{ up: "▲", left: "◀", down: "▼", right: "▶" }[d]}</button>)}
      </div>
      <p className="tiny muted center">Tap the road to hop forward, swipe to go any way, or use the arrow keys. P pauses.</p>
      <ArcadeBoard game="road" score={s.score} over={s.over} />
    </div>
  );
}
