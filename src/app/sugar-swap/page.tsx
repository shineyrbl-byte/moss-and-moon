"use client";
import "./page.css";
import { useEffect, useRef, useState } from "react";
import ArcadeBoard from "@/components/ArcadeBoard";
import { MOVES, N, SWEETS, newGame, swap, type State } from "@/lib/sugarSwap";
import { addFlag } from "@/lib/trophyFlags";
import { buzz } from "@/lib/gameSettings";

const BEST = "mm-swap-best";

export default function SugarSwap() {
  const [s, setS] = useState<State>(() => newGame(1));
  const [started, setStarted] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const [best, setBest] = useState(0);
  const [flash, setFlash] = useState("");
  useEffect(() => { try { setBest(Number(localStorage.getItem(BEST)) || 0); } catch {} setS(newGame(Date.now())); }, []);
  useEffect(() => {
    if (!s.over) return;
    if (s.score >= 3000) addFlag("swap-3000");
    if (s.score > best) { setBest(s.score); try { localStorage.setItem(BEST, String(s.score)); } catch {} }
  }, [s.over]); // eslint-disable-line react-hooks/exhaustive-deps
  function tap(i: number) {
    if (s.over) return;
    setStarted(true);
    if (sel === null) return setSel(i);
    if (sel === i) return setSel(null);
    const r = swap(s, sel, i);
    setSel(r.ok ? null : i);
    if (!r.ok) return;
    buzz(r.chains > 1 ? [20, 30, 20] : 15);
    if (r.chains > 1) { setFlash(`Chain ×${r.chains}!`); setTimeout(() => setFlash(""), 900); }
    if (r.chains >= 4) addFlag("swap-chain4");
    setS(r.s);
  }
  function again() { setS(newGame(Date.now())); setSel(null); setStarted(true); }
  // Swipe a sweet towards a neighbour to swap them
  const [from, setFrom] = useState<{ i: number; x: number; y: number } | null>(null);
  const swiped = useRef(false); // a swipe also fires a click afterwards on touch screens: skip that one
  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">an arcade game</p>
      <h1 className="h2">Sugar <em>swap</em></h1>
      <p className="small muted">Swap two neighbouring sweets to make a line of three or more of a kind. Lines clear, everything above drops, and new sweets fall in. Chains score more, and lines of four or five earn a bonus. You have {MOVES} swaps.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>Score <b>{s.score}</b></span><span>Swaps <b>{s.moves}</b></span><span>Best <b>{best}</b></span></div>
      <div className="bb-wrap">
        <div className="sw-grid" style={{ ["--n" as string]: N }} role="grid" aria-label="Sweets">
          {s.b.map((v, i) => (
            <button key={i} className={`sw-cell ${sel === i ? "on" : ""}`} aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}: ${["doughnut", "cupcake", "cookie", "sweet", "chocolate", "croissant"][v]}`} aria-pressed={sel === i}
              onClick={() => { if (swiped.current) { swiped.current = false; return; } tap(i); }}
              onPointerDown={(e) => setFrom({ i, x: e.clientX, y: e.clientY })}
              onPointerUp={(e) => {
                if (!from) return; const dx = e.clientX - from.x, dy = e.clientY - from.y; setFrom(null);
                if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
                swiped.current = true; setTimeout(() => (swiped.current = false), 400);
                const j = Math.abs(dx) > Math.abs(dy) ? from.i + (dx > 0 ? 1 : -1) : from.i + (dy > 0 ? N : -N);
                if (j < 0 || j >= N * N || (Math.abs(dx) > Math.abs(dy) && Math.floor(j / N) !== Math.floor(from.i / N))) return;
                const r = swap(s, from.i, j); setSel(null); setStarted(true); if (r.ok) { setS(r.s); buzz(15); if (r.chains > 1) { setFlash(`Chain ×${r.chains}!`); setTimeout(() => setFlash(""), 900); } }
              }}>
              <span aria-hidden="true">{SWEETS[v]}</span>
            </button>
          ))}
        </div>
        {flash && <div className="sw-flash" aria-live="polite">{flash}</div>}
        {s.over && <div className="bb-over"><b>Out of swaps: {s.score} points</b><button className="btn btn-pink btn-sm" onClick={again}>Play again</button></div>}
      </div>
      <p className="tiny muted center">Tap one sweet then a neighbour, or swipe a sweet towards it.</p>
      <ArcadeBoard game="swap" score={s.score} over={s.over && started} />
    </div>
  );
}
