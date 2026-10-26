"use client";
import "./page.css";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import TwoPlayers, { sides } from "@/components/TwoPlayers";
import { DRAW_AFTER, N, apply, bestMove, count, moves, resets, start, type Board, type Level, type Move } from "@/lib/draughts";

const STATS = "mm-draughts";
type Rec = { won: number; lost: number; drawn: number };
const empty = (): Record<Level, Rec> => ({ easy: { won: 0, lost: 0, drawn: 0 }, hard: { won: 0, lost: 0, drawn: 0 } });
type Result = "won" | "lost" | "drawn";
type Snap = { board: Board; turn: 1 | -1; quiet: number; last: Move | null; result: Result | null };
const fresh = (): Snap => ({ board: start(), turn: 1, quiet: 0, last: null, result: null });

/** Play a move and see whether the game's over */
function step(s: Snap, m: Move): Snap {
  const board = apply(s.board, m), turn = s.turn === 1 ? -1 : 1;
  const quiet = resets(s.board, m) ? 0 : s.quiet + 1;
  let result: Result | null = null;
  if (!moves(board, turn).length) result = turn === 1 ? "lost" : "won";
  else if (quiet >= DRAW_AFTER * 2) result = "drawn";
  return { board, turn, quiet, last: m, result };
}

export default function Draughts() {
  const { toast } = useStore();
  const [level, setLevel] = useState<Level>("easy");
  const [s, setS] = useState<Snap>(fresh());
  const [sel, setSel] = useState<number | null>(null);
  const [history, setHistory] = useState<Snap[]>([]);
  const [stats, setStats] = useState(empty());
  const [two, setTwo] = useState(false);
  const [p1, p2] = sides(two);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (v) { setStats({ ...empty(), ...v.stats }); if (v.level === "hard") setLevel("hard"); } } catch {}
  }, []);
  function saveStats(next: Record<Level, Rec>, lv = level) { setStats(next); try { localStorage.setItem(STATS, JSON.stringify({ stats: next, level: lv })); } catch {} }
  function finish(r: Result) {
    if (two) { toast(r === "drawn" ? "A draw: nobody's getting anywhere." : `${r === "won" ? p1 : p2} wins! 👑🎉`); return; }
    saveStats({ ...stats, [level]: { ...stats[level], [r]: stats[level][r] + 1 } });
    toast(r === "won" ? "You win! 👑🎉" : r === "lost" ? "The computer wins this one." : "A draw: nobody's getting anywhere.");
  }
  useEffect(() => {
    if (s.turn !== -1 || s.result || two) return;
    const id = setTimeout(() => {
      const m = bestMove(s.board, level);
      if (!m) return;
      const n = step(s, m);
      setS(n);
      if (n.result) finish(n.result);
    }, 600);
    return () => clearTimeout(id);
  }, [s, level, two]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = (s.turn === 1 || two) && !s.result ? moves(s.board, s.turn) : [];
  const mustCapture = mine.some((m) => m.caps.length);
  const fromSel = sel === null ? [] : mine.filter((m) => m.from === sel);
  function tap(i: number) {
    if ((s.turn !== 1 && !two) || s.result) return;
    const m = fromSel.find((x) => x.path[x.path.length - 1] === i);
    if (m) {
      setHistory([...history, s]); setSel(null);
      const n = step(s, m);
      setS(n);
      if (n.result) finish(n.result);
      return;
    }
    if (mine.some((x) => x.from === i)) setSel(i === sel ? null : i);
    else if (s.board[i] * s.turn > 0) toast(mustCapture ? "You have to take a piece if you can. Look for a jump." : "That one can't move right now.");
  }
  function newGame(lv = level, twoNow = two) {
    // Leaving a game halfway counts as a loss (not in a two-player game)
    if (!two && !s.result && history.length) saveStats({ ...stats, [level]: { ...stats[level], lost: stats[level].lost + 1 } }, lv);
    else if (lv !== level) saveStats(stats, lv);
    setLevel(lv); setTwo(twoNow); setS(fresh()); setHistory([]); setSel(null);
  }
  function undo() {
    const prev = history[history.length - 1];
    if (prev) { setS(prev); setHistory(history.slice(0, -1)); setSel(null); }
  }
  const targets = fromSel.map((m) => m.path[m.path.length - 1]);
  const lastSquares = s.last ? [s.last.from, ...s.last.path] : [];
  const rec = stats[level];
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">a board game</p>
      <h1 className="h2">Café <em>draughts</em></h1>
      <p className="small muted">Checkers against the computer. You&apos;re the pink pieces at the bottom. Move diagonally forward one square, or jump over a piece to take it. If you can take a piece, you must, and you keep jumping while you can. Reach the far side to be crowned 👑: kings move backwards too. Take every piece, or leave the other side stuck, to win.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {!two && (["easy", "hard"] as const).map((lv) => <button key={lv} className={`chip ${level === lv ? "on" : ""}`} aria-pressed={level === lv} onClick={() => lv !== level && newGame(lv)}>{lv === "easy" ? "Easy" : "Hard"}</button>)}
        <TwoPlayers on={two} onChange={(v) => newGame(level, v)} />
        <button className="btn btn-ghost btn-sm" onClick={undo} disabled={!history.length || (s.turn !== 1 && !two) || !!s.result}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => newGame()}>New game</button>
      </div>
      <div className="rv-score" aria-live="polite">
        <span className={s.turn === 1 ? "on" : ""}><i className="dr-mini you" /> {p1} <b>{count(s.board, 1)}</b></span>
        <span className="small muted">{s.result ? (s.result === "drawn" ? "Draw" : two ? `${s.result === "won" ? p1 : p2} wins! 🎉` : s.result === "won" ? "You win! 🎉" : "Computer wins") : s.turn === 1 || two ? `${two ? `${s.turn === 1 ? p1 : p2}: ` : ""}${mustCapture ? "must take" : two ? "your move" : "Your move"}` : "Thinking…"}</span>
        <span className={s.turn === -1 ? "on" : ""}><b>{count(s.board, -1)}</b> {p2} <i className="dr-mini them" /></span>
      </div>
      <div className="dr-board" role="grid" aria-label="Draughts board">
        {s.board.map((v, i) => {
          const dark = (Math.floor(i / N) + (i % N)) % 2 === 1;
          const movable = mine.some((m) => m.from === i);
          return (
            <button key={i} className={`dr-sq ${dark ? "dark" : ""} ${sel === i ? "sel" : ""} ${targets.includes(i) ? "target" : ""} ${lastSquares.includes(i) ? "last" : ""} ${movable ? "movable" : ""}`}
              disabled={!dark} onClick={() => tap(i)} aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}: ${v > 0 ? (two ? "Player 1's " : "your ") : v < 0 ? (two ? "Player 2's " : "computer's ") : ""}${Math.abs(v) === 2 ? "king" : v ? "piece" : targets.includes(i) ? "move here" : "empty"}`}>
              {v !== 0 && <i className={`dr-piece ${v > 0 ? "you" : "them"}`}>{Math.abs(v) === 2 ? "👑" : ""}</i>}
            </button>
          );
        })}
      </div>
      {s.result && <p className="center"><button className="btn btn-pink btn-sm" onClick={() => newGame()}>Play again</button></p>}
      <p className="small muted" style={{ marginTop: "1rem" }}>{two ? "Two-player games don't count towards your record. " : ""}On {level}: won {rec.won} · lost {rec.lost}{rec.drawn ? ` · drawn ${rec.drawn}` : ""}</p>
      <p className="tiny muted">Tap a piece, then where it should go. It&apos;s a draw after {DRAW_AFTER} moves each with no captures and only kings moving. Your record is kept on this device, and leaving a game halfway counts as a loss.</p>
    </div>
  );
}
