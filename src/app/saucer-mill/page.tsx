"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { MILLS, POINTS, QUIET_DRAW, bestMove, count, flying, moves, newGame, play, type Level, type Move, type State } from "@/lib/morris";

const STATS = "mm-morris";
type Rec = { won: number; lost: number; drawn: number };
const blank = (): Record<Level, Rec> => ({ easy: { won: 0, lost: 0, drawn: 0 }, hard: { won: 0, lost: 0, drawn: 0 } });
const at = (i: number) => ({ left: `${(POINTS[i][0] / 6) * 100}%`, top: `${(POINTS[i][1] / 6) * 100}%` });
// The board's lines, from the mills
const LINES = MILLS.map((m) => [POINTS[m[0]], POINTS[m[2]]]);

export default function SaucerMill() {
  const { toast } = useStore();
  const [level, setLevel] = useState<Level>("easy");
  const [s, setS] = useState<State>(newGame);
  const [history, setHistory] = useState<State[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [taking, setTaking] = useState<Move[] | null>(null); // moves waiting for you to pick a saucer to take
  const [last, setLast] = useState<Move | null>(null);
  const [stats, setStats] = useState(blank());
  const [recorded, setRecorded] = useState(false);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (v) { setStats({ ...blank(), ...v.stats }); if (v.level === "hard") setLevel("hard"); } } catch {}
  }, []);
  function saveStats(next: Record<Level, Rec>, lv = level) { setStats(next); try { localStorage.setItem(STATS, JSON.stringify({ stats: next, level: lv })); } catch {} }
  const done = s.winner !== null;
  useEffect(() => {
    if (s.turn !== 1 || done) return;
    const id = setTimeout(() => {
      const m = bestMove(s, level);
      setLast(m); setS(play(s, m));
    }, 500);
    return () => clearTimeout(id);
  }, [s, level, done]);
  useEffect(() => {
    if (!done || recorded) return;
    setRecorded(true);
    const key = s.winner === 0 ? "won" : s.winner === 1 ? "lost" : "drawn";
    saveStats({ ...stats, [level]: { ...stats[level], [key]: stats[level][key] + 1 } });
    toast(s.winner === 0 ? "You win the mill! ⚪🎉" : s.winner === 1 ? "The computer wins this one." : `A draw: ${QUIET_DRAW} moves with nothing taken.`);
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = s.turn === 0 && !done ? moves(s) : [];
  const placing = s.hand[0] > 0;
  function go(m: Move) { setHistory([...history, s]); setSel(null); setTaking(null); setLast(null); setS(play(s, m)); }
  function tap(i: number) {
    if (s.turn !== 0 || done) return;
    if (taking) { const m = taking.find((x) => x.take === i); if (m) go(m); return; }
    let options: Move[] = [];
    if (placing) options = mine.filter((m) => m.to === i);
    else if (s.board[i] === 0) { setSel(sel === i ? null : i); return; }
    else if (sel !== null) options = mine.filter((m) => m.from === sel && m.to === i);
    if (!options.length) return;
    if (options[0].take === null) go(options[0]);
    else { setTaking(options); if (placing) setSel(null); toast("A mill! Tap one of the computer's saucers to take it."); }
  }
  function newGame2(lv = level) {
    // Leaving a game halfway counts as a loss
    if (!done && history.length) saveStats({ ...stats, [level]: { ...stats[level], lost: stats[level].lost + 1 } }, lv);
    else if (lv !== level) saveStats(stats, lv);
    setLevel(lv); setS(newGame()); setHistory([]); setSel(null); setTaking(null); setLast(null); setRecorded(false);
  }
  function undo() { const p = history[history.length - 1]; if (p) { setS(p); setHistory(history.slice(0, -1)); setSel(null); setTaking(null); setLast(null); } }
  const targets = new Set(taking ? taking.map((m) => m.take!) : sel !== null ? mine.filter((m) => m.from === sel).map((m) => m.to) : placing ? mine.map((m) => m.to) : []);
  const movable = new Set(!placing && !taking ? mine.map((m) => m.from!) : []);
  const status = done ? (s.winner === 0 ? "You win! 🎉" : s.winner === 1 ? "Computer wins" : "A draw")
    : s.turn === 1 ? "Thinking…" : taking ? "Take one of theirs" : placing ? "Place a saucer" : sel !== null ? "Now where to?" : flying(s, 0) ? "Three left: hop anywhere" : "Slide a saucer";
  return (
    <div className="page" style={{ maxWidth: "32rem" }}>
      <p className="eyebrow">a board game</p>
      <h1 className="h2">Saucer <em>mill</em></h1>
      <p className="small muted">Nine men&apos;s morris against the computer. First take turns putting your nine saucers on the points. Then slide them along the lines to a free point next door. Three in a line (a mill) lets you take one of the other side&apos;s saucers, though not one in a mill unless that&apos;s all they have. Get them down to two, or leave them with no move, to win. With three left, you can hop anywhere.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {(["easy", "hard"] as const).map((lv) => <button key={lv} className={`chip ${level === lv ? "on" : ""}`} aria-pressed={level === lv} onClick={() => lv !== level && newGame2(lv)}>{lv === "easy" ? "Easy" : "Hard"}</button>)}
        <button className="btn btn-ghost btn-sm" onClick={undo} disabled={!history.length || s.turn !== 0 || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => newGame2()}>New game</button>
      </div>
      <div className="rv-score">
        <span className={s.turn === 0 && !done ? "on" : ""}><i className="dr-mini you" /> You <b>{count(s, 0) + s.hand[0]}</b></span>
        <span className={s.turn === 1 && !done ? "on" : ""}><b>{count(s, 1) + s.hand[1]}</b> Computer <i className="dr-mini them" /></span>
      </div>
      <p className="center small" aria-live="polite" style={{ margin: "0 0 0.3rem" }}>
        <b>{status}</b>{placing || s.hand[1] ? <span className="muted"> · saucers still to place: you {s.hand[0]}, computer {s.hand[1]}</span> : null}
      </p>
      <div className={`sm-board ${done ? "done" : ""}`}>
        <div className="sm-inner">
        <svg viewBox="0 0 6 6" aria-hidden="true">
          {LINES.map(([a, b], k) => <line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="sm-line" />)}
        </svg>
        {POINTS.map((_, i) => {
          const x = s.board[i];
          const lastHere = last && (last.to === i || last.from === i || last.take === i);
          return (
            <button key={i} className={`sm-point ${x === 0 ? "you" : x === 1 ? "them" : ""} ${sel === i ? "sel" : ""} ${targets.has(i) ? "target" : ""} ${movable.has(i) ? "can" : ""} ${lastHere ? "last" : ""}`}
              style={at(i)} onClick={() => tap(i)} aria-disabled={s.turn !== 0 || done}
              aria-label={`Point ${i + 1}: ${x === 0 ? "your saucer" : x === 1 ? "computer's saucer" : "empty"}${targets.has(i) ? taking ? ", tap to take" : ", tap to move here" : ""}${sel === i ? ", selected" : ""}`}>
              {x !== null && <i aria-hidden="true" />}
            </button>
          );
        })}
        </div>
      </div>
      {done && <p className="center"><button className="btn btn-pink btn-sm" onClick={() => newGame2()}>Play again</button></p>}
      <p className="small muted" style={{ marginTop: "1rem" }}>On {level}: won {stats[level].won} · lost {stats[level].lost}{stats[level].drawn ? ` · drawn ${stats[level].drawn}` : ""}</p>
      <p className="tiny muted">Easy makes mistakes; hard looks a few moves ahead and is tough to beat. The computer&apos;s last move is ringed in gold. Your record is kept on this device, and leaving a game halfway counts as a loss.</p>
    </div>
  );
}
