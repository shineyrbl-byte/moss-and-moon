"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import TwoPlayers, { sides } from "@/components/TwoPlayers";
import { N, bestMove, empty, full, play, winLine, type Cell, type Level, type Side } from "@/lib/gomoku";

const STATS = "mm-gomoku";
type Rec = { won: number; lost: number; drawn: number };
const blank = (): Record<Level, Rec> => ({ easy: { won: 0, lost: 0, drawn: 0 }, hard: { won: 0, lost: 0, drawn: 0 } });
type Snap = { b: Cell[]; turn: Side; last: number | null; line: number[] | null };
const fresh = (): Snap => ({ b: empty(), turn: 0, last: null, line: null });

export default function FiveInARow() {
  const { toast } = useStore();
  const [level, setLevel] = useState<Level>("easy");
  const [g, setG] = useState<Snap>(fresh());
  const [history, setHistory] = useState<Snap[]>([]);
  const [stats, setStats] = useState(blank());
  const [recorded, setRecorded] = useState(false);
  const [two, setTwo] = useState(false);
  const [p1, p2] = sides(two);
  const [focus, setFocus] = useState(Math.floor(N / 2) * N + Math.floor(N / 2));
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (v) { setStats({ ...blank(), ...v.stats }); if (v.level === "hard") setLevel("hard"); } } catch {}
  }, []);
  function saveStats(next: Record<Level, Rec>, lv = level) { setStats(next); try { localStorage.setItem(STATS, JSON.stringify({ stats: next, level: lv })); } catch {} }
  const done = !!g.line || full(g.b);
  const winner: Side | null = g.line ? g.b[g.line[0]] : null;
  useEffect(() => {
    if (g.turn !== 1 || done || two) return;
    const id = setTimeout(() => {
      const m = bestMove(g.b, 1, level);
      const b = play(g.b, m, 1)!;
      setG({ b, turn: 0, last: m, line: winLine(b, m) });
    }, 380);
    return () => clearTimeout(id);
  }, [g, level, done, two]);
  useEffect(() => {
    if (!done || recorded) return;
    setRecorded(true);
    const key = winner === 0 ? "won" : winner === 1 ? "lost" : "drawn";
    if (two) { toast(winner === null ? "The tablecloth's full: a draw." : `Five in a row! ${winner === 0 ? p1 : p2} wins ⭕🎉`); return; }
    saveStats({ ...stats, [level]: { ...stats[level], [key]: stats[level][key] + 1 } });
    toast(winner === 0 ? "Five in a row! You win ⭕🎉" : winner === 1 ? "The computer got five in a row." : "The tablecloth's full: a draw.");
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  function place(i: number) {
    if ((g.turn !== 0 && !two) || done) return;
    const side = g.turn;
    const b = play(g.b, i, side);
    if (!b) return;
    setHistory([...history, g]);
    setG({ b, turn: side === 0 ? 1 : 0, last: i, line: winLine(b, i) });
  }
  function newGame(lv = level, twoNow = two) {
    // Leaving a game halfway counts as a loss (not in a two-player game)
    if (!two && !done && history.length) saveStats({ ...stats, [level]: { ...stats[level], lost: stats[level].lost + 1 } }, lv);
    else if (lv !== level) saveStats(stats, lv);
    setLevel(lv); setTwo(twoNow); setG(fresh()); setHistory([]); setRecorded(false);
  }
  function undo() {
    const prev = history[history.length - 1];
    if (prev) { setG(prev); setHistory(history.slice(0, -1)); }
  }
  function key(e: React.KeyboardEvent, i: number) {
    const r = Math.floor(i / N), c = i % N;
    const to: Record<string, number> = { ArrowUp: r > 0 ? i - N : i, ArrowDown: r < N - 1 ? i + N : i, ArrowLeft: c > 0 ? i - 1 : i, ArrowRight: c < N - 1 ? i + 1 : i };
    if (e.key in to) { e.preventDefault(); setFocus(to[e.key]); cells.current[to[e.key]]?.focus(); }
  }
  const rec = stats[level];
  const win = new Set(g.line ?? []);
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">a board game</p>
      <h1 className="h2">Five <em>in a row</em></h1>
      <p className="small muted">You and the computer take turns putting cups on the tablecloth. Get five of yours in a line (across, down or diagonally) to win. Cups stay where they&apos;re put, so watch for the computer lining up four, and block an open three before it becomes one.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {!two && (["easy", "hard"] as const).map((lv) => <button key={lv} className={`chip ${level === lv ? "on" : ""}`} aria-pressed={level === lv} onClick={() => lv !== level && newGame(lv)}>{lv === "easy" ? "Easy" : "Hard"}</button>)}
        <TwoPlayers on={two} onChange={(v) => newGame(level, v)} />
        <button className="btn btn-ghost btn-sm" onClick={undo} disabled={!history.length || (g.turn !== 0 && !two) || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => newGame()}>New game</button>
      </div>
      <div className="rv-score" aria-live="polite">
        <span className={g.turn === 0 && !done ? "on" : ""}><i className="dr-mini you" /> {p1}</span>
        <span className="small muted">{done ? (winner === null ? "A draw" : two ? `${winner === 0 ? p1 : p2} wins! 🎉` : winner === 0 ? "You win! 🎉" : "Computer wins") : two ? `${g.turn === 0 ? p1 : p2}'s cup` : g.turn === 0 ? "Your cup" : "Thinking…"}</span>
        <span className={g.turn === 1 && !done ? "on" : ""}>{p2} <i className="dr-mini them" /></span>
      </div>
      <div className={`fr-board ${done ? "done" : ""}`} style={{ ["--n" as string]: N }} role="grid" aria-label="Tablecloth">
        {g.b.map((x, i) => (
          <button key={i} ref={(el) => { cells.current[i] = el; }} className={`fr-cell ${win.has(i) ? "win" : ""} ${g.last === i ? "last" : ""}`}
            tabIndex={focus === i ? 0 : -1} onFocus={() => setFocus(i)} onKeyDown={(e) => key(e, i)} onClick={() => place(i)}
            aria-disabled={x !== null || (g.turn !== 0 && !two) || done}
            aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}: ${x === 0 ? (two ? "Player 1's cup" : "your cup") : x === 1 ? (two ? "Player 2's cup" : "computer's cup") : "empty"}${g.last === i ? ", last move" : ""}`}>
            {x !== null && <i className={`fr-cup ${x ? "them" : "you"}`} aria-hidden="true" />}
          </button>
        ))}
      </div>
      {done && <p className="center"><button className="btn btn-pink btn-sm" onClick={() => newGame()}>Play again</button></p>}
      <p className="small muted" style={{ marginTop: "1rem" }}>{two ? "Two-player games don't count towards your record. " : ""}On {level}: won {rec.won} · lost {rec.lost}{rec.drawn ? ` · drawn ${rec.drawn}` : ""}</p>
      <p className="tiny muted">You always go first, which is a real head start. Easy gets distracted by its own plans; hard blocks everything it sees. On a keyboard, move with the arrows and press Enter to place a cup. Your record is kept on this device, and leaving a game halfway counts as a loss.</p>
    </div>
  );
}
