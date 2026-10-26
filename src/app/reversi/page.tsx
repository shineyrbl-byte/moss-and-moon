"use client";
import "./page.css";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import TwoPlayers, { sides } from "@/components/TwoPlayers";
import { N, bestMove, count, flips, legal, nextTurn, play, start, type Board, type Level } from "@/lib/reversi";

const STATS = "mm-reversi";
type Rec = { won: number; lost: number; drawn: number };
type Stats = Record<Level, Rec>;
const empty = (): Stats => ({ easy: { won: 0, lost: 0, drawn: 0 }, hard: { won: 0, lost: 0, drawn: 0 } });
type Snap = { board: Board; turn: number | null; last: number | null };

export default function Reversi() {
  const { toast } = useStore();
  const [level, setLevel] = useState<Level>("easy");
  const [s, setS] = useState<Snap>({ board: start(), turn: 1, last: null });
  const [history, setHistory] = useState<Snap[]>([]);
  const [stats, setStats] = useState<Stats>(empty());
  const [recorded, setRecorded] = useState(false);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [two, setTwo] = useState(false);
  const [p1, p2] = sides(two);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (v) { setStats({ ...empty(), ...v.stats }); if (v.level === "hard") setLevel("hard"); } } catch {}
  }, []);
  function saveStats(next: Stats, lv = level) { setStats(next); try { localStorage.setItem(STATS, JSON.stringify({ stats: next, level: lv })); } catch {} }

  const over = s.turn === null;
  const mine = count(s.board, 1), theirs = count(s.board, 2);
  // The computer thinks for a moment, then plays
  useEffect(() => {
    if (s.turn !== 2 || two) return;
    const id = setTimeout(() => {
      const m = bestMove(s.board, 2, level);
      if (m === null) return;
      setFlipped(flips(s.board, m, 2));
      const b = play(s.board, m, 2)!;
      const turn = nextTurn(b, 1);
      if (turn === 2) toast("You've no moves, so the computer goes again.");
      setS({ board: b, turn, last: m });
    }, 550);
    return () => clearTimeout(id);
  }, [s, level, toast, two]);
  useEffect(() => {
    if (!over || recorded) return;
    setRecorded(true);
    const r = mine > theirs ? "won" : mine < theirs ? "lost" : "drawn";
    if (two) { toast(r === "drawn" ? "A draw!" : `${r === "won" ? p1 : p2} wins! 🎉`); return; }
    saveStats({ ...stats, [level]: { ...stats[level], [r]: stats[level][r] + 1 } });
    toast(r === "won" ? "You win! ☕🎉" : r === "lost" ? "The computer wins this one." : "A draw!");
  }, [over]); // eslint-disable-line react-hooks/exhaustive-deps

  function tap(i: number) {
    const side = s.turn;
    if (side === null || (side === 2 && !two)) return;
    const b = play(s.board, i, side);
    if (!b) return;
    setHistory([...history, s]);
    setFlipped(flips(s.board, i, side));
    const other = side === 1 ? 2 : 1;
    const turn = nextTurn(b, other);
    if (turn === side) toast(two ? `${other === 1 ? p1 : p2} has no moves, so ${side === 1 ? p1 : p2} goes again.` : "The computer has no moves. Your go again.");
    setS({ board: b, turn, last: i });
  }
  function newGame(lv = level, twoNow = two) {
    // Leaving a game halfway counts as a loss, so you can't dodge one (not in a two-player game)
    if (!two && !over && history.length > 0) saveStats({ ...stats, [level]: { ...stats[level], lost: stats[level].lost + 1 } }, lv);
    else if (lv !== level) saveStats(stats, lv);
    setLevel(lv); setTwo(twoNow); setS({ board: start(), turn: 1, last: null }); setHistory([]); setRecorded(false); setFlipped([]);
  }
  function undo() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setS(prev); setHistory(history.slice(0, -1)); setFlipped([]);
  }
  const moves = s.turn === 1 || (two && s.turn === 2) ? legal(s.board, s.turn) : [];
  const rec = stats[level];
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">a board game</p>
      <h1 className="h2">Bean <em>reversi</em></h1>
      <p className="small muted">You&apos;re the coffee beans, the computer is the milk. Place a bean so that it traps a line of milk between it and another of your beans, and the whole line turns to coffee. The dots show where you can go. Whoever has the most at the end wins.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {!two && (["easy", "hard"] as const).map((lv) => <button key={lv} className={`chip ${level === lv ? "on" : ""}`} aria-pressed={level === lv} onClick={() => lv !== level && newGame(lv)}>{lv === "easy" ? "Easy" : "Hard"}</button>)}
        <TwoPlayers on={two} onChange={(v) => newGame(level, v)} />
        <button className="btn btn-ghost btn-sm" onClick={undo} disabled={!history.length || (s.turn === 2 && !two) || over}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => newGame()}>New game</button>
      </div>
      <div className="rv-score" aria-live="polite">
        <span className={s.turn === 1 ? "on" : ""}><i className="rv-disc dark" /> {p1} <b>{mine}</b></span>
        <span className="small muted">{over ? (mine === theirs ? "Draw" : two ? `${mine > theirs ? p1 : p2} wins! 🎉` : mine > theirs ? "You win! 🎉" : "Computer wins") : two ? `${s.turn === 1 ? p1 : p2}'s move` : s.turn === 1 ? "Your move" : "Thinking…"}</span>
        <span className={s.turn === 2 ? "on" : ""}><b>{theirs}</b> {p2} <i className="rv-disc light" /></span>
      </div>
      <div className="rv-board" role="grid" aria-label="Reversi board">
        {s.board.map((v, i) => {
          const can = moves.includes(i);
          return (
            <button key={i} className={`rv-sq ${can ? "can" : ""} ${s.last === i ? "last" : ""}`} onClick={() => tap(i)} disabled={!can}
              aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}: ${v === 1 ? "your bean" : v === 2 ? "milk" : can ? "you can play here" : "empty"}`}>
              {v > 0 && <i key={`${v}-${flipped.includes(i)}`} className={`rv-disc ${v === 1 ? "dark" : "light"} ${flipped.includes(i) ? "flip" : ""}`} />}
            </button>
          );
        })}
      </div>
      {over && <p className="center"><button className="btn btn-pink btn-sm" onClick={() => newGame()}>Play again</button></p>}
      <p className="small muted" style={{ marginTop: "1rem" }}>
        {two ? "Two-player games don't count towards your record. " : ""}On {level}: won {rec.won} · lost {rec.lost}{rec.drawn ? ` · drawn ${rec.drawn}` : ""}
      </p>
      <p className="tiny muted">Easy plays loosely. Hard looks a few moves ahead and loves a corner. Your record is kept on this device, and leaving a game halfway counts as a loss.</p>
    </div>
  );
}
