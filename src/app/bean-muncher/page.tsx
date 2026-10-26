"use client";
import "./page.css";
import { useEffect, useRef, useState } from "react";
import ArcadeBoard from "@/components/ArcadeBoard";
import { COLS, MAP, ROWS, newGame, nextRound, steer, step, tickSecs, type Dir, type State } from "@/lib/muncher";
import { addFlag } from "@/lib/trophyFlags";

const BEST = "mm-muncher-best";
const KEYS: Record<string, Dir> = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3 };
const FACE = ["▲", "▶", "▼", "◀"];

export default function BeanMuncher() {
  const [s, setS] = useState<State>(() => newGame());
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [best, setBest] = useState(0);
  const live = useRef(s), swipe = useRef<{ x: number; y: number } | null>(null);
  live.current = s;
  useEffect(() => { try { setBest(Number(localStorage.getItem(BEST)) || 0); } catch {} }, []);
  useEffect(() => {
    if (!playing || paused || s.over || s.cleared) return;
    const id = setInterval(() => { const n = step(live.current); live.current = n; setS(n); }, tickSecs(s.round) * 1000);
    return () => clearInterval(id);
  }, [playing, paused, s.over, s.cleared, s.round]);
  useEffect(() => {
    if (s.cleared && s.round >= 3) addFlag("muncher-round3");
    if (s.over && s.score > best) { setBest(s.score); try { localStorage.setItem(BEST, String(s.score)); } catch {} }
  }, [s.over, s.cleared]); // eslint-disable-line react-hooks/exhaustive-deps
  function go(d: Dir) { const n = steer(live.current, d); live.current = n; setS(n); if (!playing) begin(n); }
  function begin(from?: State) { const n = from && !from.over ? from : newGame(); live.current = n; setS(n); setPlaying(true); setPaused(false); }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      const d = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
      if (d !== undefined) { e.preventDefault(); go(d); }
      else if (e.key === "p" && playing) setPaused((x) => !x);
    };
    const hide = () => { if (document.hidden) setPaused(true); };
    window.addEventListener("keydown", h); document.addEventListener("visibilitychange", hide);
    return () => { window.removeEventListener("keydown", h); document.removeEventListener("visibilitychange", hide); };
  });
  const cats = new Map(s.cats.map((k) => [k.r * COLS + k.c, k]));
  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">an arcade game</p>
      <h1 className="h2">Bean <em>muncher</em></h1>
      <p className="small muted">Munch every coffee bean on the café floor while the café cats prowl. Grab an espresso ☕ and the cats run scared for a few seconds, and you can chase them off for big points. Clear the floor for a quicker round.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>Score <b>{s.score}</b></span><span>Round <b>{s.round}</b></span><span aria-label={`${s.lives} lives`}>{"♥".repeat(Math.max(0, s.lives))}</span><span>Best <b>{best}</b></span></div>
      <div className="bb-wrap">
        <div className={`bm-grid ${s.scared ? "scared" : ""}`} style={{ ["--c" as string]: COLS, ["--r" as string]: ROWS }} role="img" aria-label={`Bean muncher: ${s.beans.size} beans left, score ${s.score}`}
          onPointerDown={(e) => { swipe.current = { x: e.clientX, y: e.clientY }; }}
          onPointerUp={(e) => { const st = swipe.current; swipe.current = null; if (!st) return; const dx = e.clientX - st.x, dy = e.clientY - st.y; if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return; go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0); }}>
          {MAP.flatMap((row, r) => [...row].map((ch, c) => {
            const i = r * COLS + c, cat = cats.get(i), me = s.r === r && s.c === c;
            return (
              <span key={i} className={`bm-sq ${ch === "#" ? "wall" : ""}`}>
                {me ? <i className="bm-me" style={{ transform: `rotate(${[270, 0, 90, 180][s.dir]}deg)` }} /> : cat ? <span className={`bm-cat ${s.scared ? "scared" : ""}`}>{s.scared ? "🙀" : "🐈"}</span> : s.beans.has(i) ? <i className="bm-bean" /> : s.cups.has(i) ? <span className="bm-cup">☕</span> : null}
              </span>
            );
          }))}
        </div>
        {(!playing || s.over || s.cleared || paused) && (
          <div className="bb-over">
            {s.over ? <><b>Caught! {s.score} points</b><button className="btn btn-pink btn-sm" onClick={() => begin()}>Play again</button></>
              : s.cleared ? <><b>Round {s.round} cleared! 🎉</b><button className="btn btn-pink btn-sm" onClick={() => begin(nextRound(s))}>Next round →</button></>
              : paused ? <><b>Paused</b><button className="btn btn-pink btn-sm" onClick={() => setPaused(false)}>Carry on</button></>
              : <button className="btn btn-pink" onClick={() => begin()}>▶ Start munching</button>}
          </div>
        )}
      </div>
      <div className="tp-pad" aria-label="Steer">
        {[0, 3, 2, 1].map((d) => <button key={d} className={`btn btn-ghost btn-sm ${["up", "left", "down", "right"][[0, 3, 2, 1].indexOf(d)]}`} onClick={() => go(d as Dir)} aria-label={["Up", "Right", "Down", "Left"][d]}>{FACE[d]}</button>)}
      </div>
      <p className="tiny muted center">Arrow keys, WASD, swipe, or the buttons. You keep going until you turn. P pauses.</p>
      <ArcadeBoard game="muncher" score={s.score} over={s.over} />
    </div>
  );
}
