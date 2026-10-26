"use client";
import "./page.css";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import TwoPlayers from "@/components/TwoPlayers";
import { HOLES, TARGET, bestMove, move, newGame, pixel, reach, type Level, type State } from "@/lib/chineseCheckers";
import { addFlag } from "@/lib/trophyFlags";

const STATS = "mm-star";
type Rec = { won: number; lost: number };
const PTS = HOLES.map(pixel);
const xs = PTS.map((p) => p[0]), ys = PTS.map((p) => p[1]);
const BOX = { x: Math.min(...xs) - 1, y: Math.min(...ys) - 1, w: Math.max(...xs) - Math.min(...xs) + 2, h: Math.max(...ys) - Math.min(...ys) + 2 };

export default function StarCheckers() {
  const { toast } = useStore();
  const [level, setLevel] = useState<Level>("easy");
  const [two, setTwo] = useState(false);
  const [s, setS] = useState<State>(newGame);
  const [sel, setSel] = useState<number | null>(null);
  const [history, setHistory] = useState<State[]>([]);
  const [stats, setStats] = useState<Record<Level, Rec>>({ easy: { won: 0, lost: 0 }, hard: { won: 0, lost: 0 } });
  const [recorded, setRecorded] = useState(false);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (v) { setStats({ easy: { won: 0, lost: 0 }, hard: { won: 0, lost: 0 }, ...v.stats }); if (v.level === "hard") setLevel("hard"); } } catch {}
  }, []);
  function saveStats(next: Record<Level, Rec>, lv = level) { setStats(next); try { localStorage.setItem(STATS, JSON.stringify({ stats: next, level: lv })); } catch {} }
  useEffect(() => {
    if (two || s.winner !== null || s.turn !== 1) return;
    const id = setTimeout(() => { const m = bestMove(s, level); if (m) setS(move(s, m[0], m[1])!); }, 450);
    return () => clearTimeout(id);
  }, [s, level, two]);
  useEffect(() => {
    if (s.winner === null || recorded) return;
    setRecorded(true);
    if (two) { toast(`${s.winner === 0 ? "Pink" : "Brown"} gets every marble across! 🎉`); return; }
    const won = s.winner === 0;
    if (won) addFlag("star-win");
    saveStats({ ...stats, [level]: { ...stats[level], [won ? "won" : "lost"]: stats[level][won ? "won" : "lost"] + 1 } });
    toast(won ? "All ten across: you win! ✨🎉" : "The computer got there first.");
  }, [s.winner]); // eslint-disable-line react-hooks/exhaustive-deps
  function newGame2(lv = level, twoNow = two) {
    if (!two && s.winner === null && s.moves > 4) saveStats({ ...stats, [level]: { ...stats[level], lost: stats[level].lost + 1 } }, lv);
    else if (lv !== level) saveStats(stats, lv);
    setLevel(lv); setTwo(twoNow); setS(newGame()); setSel(null); setHistory([]); setRecorded(false);
  }
  const human = two || s.turn === 0;
  const targets = useMemo(() => (sel === null ? new Map<number, number[]>() : reach(s, sel)), [s, sel]);
  function tap(i: number) {
    if (!human || s.winner !== null) return;
    if (sel !== null && targets.has(i)) { setHistory([...history, s]); setS(move(s, sel, i)!); setSel(null); return; }
    setSel(s.at[i] === s.turn && sel !== i ? i : null);
  }
  const done = (p: 0 | 1) => TARGET[p].filter((i) => s.at[i] === p).length;
  const lastPath = s.last ?? [];
  const status = s.winner !== null ? (two ? `${s.winner === 0 ? "Pink" : "Brown"} wins!` : s.winner === 0 ? "You win! 🎉" : "The computer wins") : !human ? "Thinking…" : two ? `${s.turn === 0 ? "Pink" : "Brown"} to move` : sel === null ? "Pick a marble" : "Now pick where it goes";
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">a board game</p>
      <h1 className="h2">Star <em>checkers</em></h1>
      <p className="small muted">Chinese checkers for two. Race your ten pink marbles from the bottom point of the star into the top one, while the computer heads the other way. Move to a neighbouring hole, or hop over any marble into the empty hole just beyond, and keep hopping in one go if you can. First to fill the far point wins.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {!two && (["easy", "hard"] as const).map((lv) => <button key={lv} className={`chip ${level === lv ? "on" : ""}`} aria-pressed={level === lv} onClick={() => lv !== level && newGame2(lv)}>{lv === "easy" ? "Easy" : "Hard"}</button>)}
        <TwoPlayers on={two} onChange={(v) => newGame2(level, v)} />
        <button className="btn btn-ghost btn-sm" onClick={() => { const p = history[history.length - 1]; if (p) { setS(p); setHistory(history.slice(0, -1)); setSel(null); } }} disabled={!history.length || !human || s.winner !== null}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => newGame2()}>New game</button>
      </div>
      <div className="rv-score" aria-live="polite">
        <span className={s.turn === 0 && s.winner === null ? "on" : ""}><i className="dr-mini you" /> {two ? "Pink" : "You"} <b>{done(0)}</b>/10</span>
        <span className="small muted">{status}</span>
        <span className={s.turn === 1 && s.winner === null ? "on" : ""}><b>{done(1)}</b>/10 {two ? "Brown" : "Computer"} <i className="dr-mini them" /></span>
      </div>
      <div className="st-board">
        <svg viewBox={`${BOX.x} ${BOX.y} ${BOX.w} ${BOX.h}`} role="group" aria-label="Star board">
          <polygon className="st-star" points={[[0, -12], [3.46, -6], [10.4, -6], [6.93, 0], [10.4, 6], [3.46, 6], [0, 12], [-3.46, 6], [-10.4, 6], [-6.93, 0], [-10.4, -6], [-3.46, -6]].map(([x, y]) => `${x * 1.06},${y * 1.06}`).join(" ")} />
          {lastPath.length > 1 && <polyline className="st-path" points={lastPath.map((i) => PTS[i].join(",")).join(" ")} />}
          {HOLES.map((_, i) => {
            const [x, y] = PTS[i], who = s.at[i], can = targets.has(i);
            return (
              <g key={i} role="button" tabIndex={human && (who === s.turn || can) ? 0 : -1} onClick={() => tap(i)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tap(i); } }}
                aria-label={`Hole ${i + 1}: ${who === 0 ? "pink marble" : who === 1 ? "brown marble" : can ? "you can move here" : "empty"}`} className="st-hole-g">
                <circle cx={x} cy={y} r={0.62} className={`st-hole ${can ? "can" : ""}`} />
                {who !== null && <circle cx={x} cy={y} r={0.5} className={`st-marble ${who === 0 ? "you" : "them"} ${sel === i ? "sel" : ""}`} />}
              </g>
            );
          })}
        </svg>
      </div>
      {s.winner !== null && <p className="center"><button className="btn btn-pink btn-sm" onClick={() => newGame2()}>Play again</button></p>}
      <p className="small muted" style={{ marginTop: "1rem" }}>{two ? "Two-player games don't count towards your record. " : ""}On {level}: won {stats[level].won} · lost {stats[level].lost}</p>
      <p className="tiny muted">Long chains of hops are the way to win. The computer&apos;s last move is traced on the board.</p>
    </div>
  );
}
