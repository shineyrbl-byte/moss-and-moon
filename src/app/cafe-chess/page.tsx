"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import { bestMove, colorOf, inCheck, kingAt, moves, name, newGame, play, result, san, type Color, type Level, type Move, type State } from "@/lib/chess";

const STATS = "mm-chess";
type Rec = { won: number; lost: number; drawn: number };
const blank = (): Record<Level, Rec> => ({ easy: { won: 0, lost: 0, drawn: 0 }, hard: { won: 0, lost: 0, drawn: 0 } });
const GLYPH: Record<string, string> = { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" };
const WORD: Record<string, string> = { K: "king", Q: "queen", R: "rook", B: "bishop", N: "knight", P: "pawn" };
const WHY: Record<string, string> = { stalemate: "Stalemate: no legal move, but not in check.", fifty: "Fifty moves with no capture or pawn move.", repetition: "The same position three times.", material: "Not enough pieces left for anyone to win." };
type Snap = { s: State; log: string[]; last: Move | null };

export default function CafeChess() {
  const { toast } = useStore();
  const [level, setLevel] = useState<Level>("easy");
  const [me, setMe] = useState<Color>("w");
  const [g, setG] = useState<Snap>({ s: newGame(), log: [], last: null });
  const [history, setHistory] = useState<Snap[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [promo, setPromo] = useState<Move[] | null>(null);
  const [stats, setStats] = useState(blank());
  const [recorded, setRecorded] = useState(false);
  const logRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (v) { setStats({ ...blank(), ...v.stats }); if (v.level === "hard") setLevel("hard"); } } catch {}
  }, []);
  function saveStats(next: Record<Level, Rec>, lv = level) { setStats(next); try { localStorage.setItem(STATS, JSON.stringify({ stats: next, level: lv })); } catch {} }
  const legal = moves(g.s);
  const res = result(g.s, legal);
  const done = res.over;
  // The computer's move: let the board draw "thinking" first, then work it out
  useEffect(() => {
    if (done || g.s.turn === me) return;
    const id = setTimeout(() => {
      const m = bestMove(g.s, level);
      setG({ s: play(g.s, m), log: [...g.log, san(g.s, m)], last: m });
    }, 120);
    return () => clearTimeout(id);
  }, [g, level, me, done]);
  useEffect(() => { logRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" }); }, [g.log.length]);
  useEffect(() => {
    if (!done || recorded) return;
    setRecorded(true);
    const won = res.winner === me, key = res.winner === null ? "drawn" : won ? "won" : "lost";
    saveStats({ ...stats, [level]: { ...stats[level], [key]: stats[level][key] + 1 } });
    toast(res.why === "checkmate" ? (won ? "Checkmate! You win ♟️🎉" : "Checkmate. The computer wins.") : `A draw. ${WHY[res.why]}`);
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  function go(m: Move) {
    setHistory([...history, g]);
    setG({ s: play(g.s, m), log: [...g.log, san(g.s, m)], last: m });
    setSel(null); setPromo(null);
  }
  function tap(i: number) {
    if (done || g.s.turn !== me || promo) return;
    const p = g.s.b[i];
    if (sel !== null) {
      const ms = legal.filter((m) => m.from === sel && m.to === i);
      if (ms.length > 1) { setPromo(ms); return; }
      if (ms.length === 1) { go(ms[0]); return; }
    }
    if (p && colorOf(p) === me) setSel(sel === i ? null : i);
    else setSel(null);
  }
  function newGame2(lv = level, side = me) {
    if (!done && history.length) saveStats({ ...stats, [level]: { ...stats[level], lost: stats[level].lost + 1 } }, lv);
    else if (lv !== level) saveStats(stats, lv);
    setLevel(lv); setMe(side); setG({ s: newGame(), log: [], last: null }); setHistory([]); setSel(null); setPromo(null); setRecorded(false);
  }
  function undo() {
    // Back to before your last move (and the computer's reply)
    const prev = history[history.length - 1];
    if (prev) { setG(prev); setHistory(history.slice(0, -1)); setSel(null); setPromo(null); }
  }
  const targets = new Set(sel === null ? [] : legal.filter((m) => m.from === sel).map((m) => m.to));
  const checkSq = inCheck(g.s) ? kingAt(g.s.b, g.s.turn) : -1;
  const order = [...Array(64).keys()];
  if (me === "b") order.reverse();
  const taken = (c: Color) => {
    const start: Record<string, number> = { P: 8, N: 2, B: 2, R: 2, Q: 1 };
    const left: Record<string, number> = {};
    for (const p of g.s.b) if (p && colorOf(p) === c) left[p.toUpperCase()] = (left[p.toUpperCase()] ?? 0) + 1;
    return Object.entries(start).flatMap(([t, n]) => Array(Math.max(0, n - (left[t] ?? 0))).fill(GLYPH[t])).join("");
  };
  const status = done ? (res.why === "checkmate" ? (res.winner === me ? "Checkmate: you win! 🎉" : "Checkmate: the computer wins") : "A draw")
    : g.s.turn === me ? (checkSq >= 0 ? "You're in check!" : sel !== null ? "Now pick a square" : "Your move") : "Thinking…";
  return (
    <div className="page" style={{ maxWidth: "36rem" }}>
      <p className="eyebrow">a board game</p>
      <h1 className="h2">Café <em>chess</em></h1>
      <p className="small muted">Chess against the computer, with all the rules: castling, en passant, promotion, check and checkmate. Tap a piece to see where it can go, then tap a square. Easy makes mistakes; hard looks three moves ahead and plays every capture through to the end.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {(["easy", "hard"] as const).map((lv) => <button key={lv} className={`chip ${level === lv ? "on" : ""}`} aria-pressed={level === lv} onClick={() => lv !== level && newGame2(lv)}>{lv === "easy" ? "Easy" : "Hard"}</button>)}
        <button className="chip" onClick={() => newGame2(level, me === "w" ? "b" : "w")}>Play as {me === "w" ? "black" : "white"}</button>
        <button className="btn btn-ghost btn-sm" onClick={undo} disabled={!history.length || g.s.turn !== me || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => newGame2()}>New game</button>
      </div>
      <p className="center small" aria-live="polite" style={{ margin: "0.6rem 0 0.3rem" }}><b>{status}</b>{done && res.why !== "checkmate" ? <span className="muted"> · {WHY[res.why]}</span> : null}</p>
      <p className="cc-taken" aria-label="Pieces the computer has taken">{taken(me)}</p>
      <div className="cc-board" role="grid" aria-label="Chess board">
        {order.map((i) => {
          const p = g.s.b[i], dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
          const last = g.last && (g.last.from === i || g.last.to === i);
          return (
            <button key={i} className={`cc-sq ${dark ? "dark" : "light"} ${sel === i ? "sel" : ""} ${targets.has(i) ? (p ? "hit" : "dot") : ""} ${last ? "last" : ""} ${checkSq === i ? "check" : ""}`}
              onClick={() => tap(i)} aria-label={`${name(i)}${p ? `: ${colorOf(p) === "w" ? "white" : "black"} ${WORD[p.toUpperCase()]}` : ""}${targets.has(i) ? ", you can move here" : ""}`}>
              {p && <span className={`cc-piece ${colorOf(p)}`} aria-hidden="true">{GLYPH[p.toUpperCase()]}</span>}
              {(me === "w" ? i % 8 === 0 : i % 8 === 7) && <small className="cc-rank" aria-hidden="true">{8 - Math.floor(i / 8)}</small>}
              {(me === "w" ? i >= 56 : i < 8) && <small className="cc-file" aria-hidden="true">{name(i)[0]}</small>}
            </button>
          );
        })}
      </div>
      <p className="cc-taken" aria-label="Pieces you have taken">{taken(me === "w" ? "b" : "w")}</p>
      {promo && (
        <div className="cc-promo" role="dialog" aria-label="Promote your pawn">
          <span className="small">Promote to:</span>
          {promo.map((m) => <button key={m.promo} className="btn btn-ghost" onClick={() => go(m)} aria-label={WORD[m.promo!.toUpperCase()]}><span className={`cc-piece ${me}`}>{GLYPH[m.promo!.toUpperCase()]}</span></button>)}
          <button className="btn btn-ghost btn-sm" onClick={() => setPromo(null)}>Cancel</button>
        </div>
      )}
      {done && <p className="center"><button className="btn btn-pink btn-sm" onClick={() => newGame2()}>Play again</button></p>}
      {g.log.length > 0 && (
        <ol className="cc-log" ref={logRef} aria-label="Moves so far">
          {g.log.filter((_, k) => k % 2 === 0).map((w, k) => <li key={k}><span>{w}</span><span>{g.log[2 * k + 1] ?? ""}</span></li>)}
        </ol>
      )}
      <p className="small muted" style={{ marginTop: "1rem" }}>On {level}: won {stats[level].won} · lost {stats[level].lost}{stats[level].drawn ? ` · drawn ${stats[level].drawn}` : ""}</p>
      <p className="tiny muted">The last move is shaded, and a king in check is ringed in red. Your record is kept on this device, and leaving a game halfway counts as a loss.</p>
    </div>
  );
}
