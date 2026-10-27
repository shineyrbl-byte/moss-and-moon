"use client";
import "./page.css";
import { useEffect, useRef, useState } from "react";
import ArcadeBoard from "@/components/ArcadeBoard";
import { GAME_MS, HOLES, POINTS, scoreOf, schedule, showing, tap, type Pop } from "@/lib/cupcakes";
import { addFlag } from "@/lib/trophyFlags";
import { buzz } from "@/lib/gameSettings";

const BEST = "mm-cupcakes-best";
const FACE = { cake: "🧁", gold: "🌟", burnt: "🔥" } as const;

export default function PopTheCupcakes() {
  const [pops, setPops] = useState<Pop[]>([]);
  const [hit, setHit] = useState<Set<number>>(new Set());
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [best, setBest] = useState(0);
  const [splat, setSplat] = useState<{ hole: number; text: string; id: number } | null>(null);
  const startAt = useRef(0), hitRef = useRef(hit);
  hitRef.current = hit;
  useEffect(() => { try { setBest(Number(localStorage.getItem(BEST)) || 0); } catch {} }, []);
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const frame = (now: number) => {
      const el = now - startAt.current;
      setT(el);
      if (el >= GAME_MS) { setRunning(false); setOver(true); return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running]);
  const score = scoreOf(pops, hit);
  useEffect(() => {
    if (!over) return;
    if (pops.some((p, i) => p.kind === "burnt" && hit.has(i)) === false && score >= 300) addFlag("cupcakes-clean");
    if (score > best) { setBest(score); try { localStorage.setItem(BEST, String(score)); } catch {} }
  }, [over]); // eslint-disable-line react-hooks/exhaustive-deps
  function begin() {
    setPops(schedule(Math.random)); setHit(new Set()); setT(0); setOver(false); setSplat(null);
    startAt.current = performance.now(); setRunning(true);
  }
  function whack(hole: number) {
    if (!running) return;
    const el = performance.now() - startAt.current, i = tap(pops, hitRef.current, hole, el);
    if (i === null) return;
    const next = new Set(hitRef.current); next.add(i); hitRef.current = next; setHit(next);
    const pts = POINTS[pops[i].kind];
    setSplat({ hole, text: pts > 0 ? `+${pts}` : `${pts}`, id: i });
    if (pops[i].kind === "burnt") buzz([60, 40, 60]); else buzz(15);
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      // Number keys 1–9 match the tins, like a phone keypad from the top left
      const k = Number(e.key);
      if (k >= 1 && k <= 9 && (e.target as HTMLElement).tagName !== "INPUT") { e.preventDefault(); whack(k - 1); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  const up = running ? showing(pops, hit, t) : [];
  const left = Math.max(0, Math.ceil((GAME_MS - t) / 1000));
  return (
    <div className="page" style={{ maxWidth: "28rem" }}>
      <p className="eyebrow">an arcade game</p>
      <h1 className="h2">Pop the <em>cupcakes</em></h1>
      <p className="small muted">Cupcakes pop up out of the tins for a moment. Tap them before they sink back down: 🧁 is {POINTS.cake}, a golden 🌟 is {POINTS.gold}. Leave the burnt 🔥 ones alone, they cost {-POINTS.burnt}. Thirty seconds, and it gets quicker.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>Score <b>{score}</b></span><span>⏱ <b>{running ? left : over ? 0 : 30}</b>s</span><span>Best <b>{best}</b></span></div>
      <div className="bb-wrap">
        <div className="pop-tins" role="group" aria-label="Cupcake tins">
          {[...Array(HOLES).keys()].map((h) => {
            const i = up.find((k) => pops[k].hole === h), p = i !== undefined ? pops[i] : null;
            return (
              <button key={h} className={`pop-tin ${p ? `up ${p.kind}` : ""}`} onPointerDown={(e) => { e.preventDefault(); whack(h); }} aria-label={`Tin ${h + 1}${p ? `: ${p.kind === "burnt" ? "burnt cupcake, leave it" : p.kind === "gold" ? "golden cupcake" : "cupcake"}` : ""}`}>
                <span className="pop-cake" aria-hidden="true">{p ? FACE[p.kind] : ""}</span>
                {splat?.hole === h && <span key={splat.id} className="pop-splat" aria-hidden="true">{splat.text}</span>}
              </button>
            );
          })}
        </div>
        {!running && (
          <div className="bb-over">
            {over ? <><b>Time! {score} points</b><button className="btn btn-pink btn-sm" onClick={begin}>Play again</button></> : <button className="btn btn-pink" onClick={begin}>▶ Start popping</button>}
          </div>
        )}
      </div>
      <p className="tiny muted center">On a keyboard, 1 to 9 tap the tins (top left is 1).</p>
      <ArcadeBoard game="cupcakes" score={score} over={over} />
    </div>
  );
}
