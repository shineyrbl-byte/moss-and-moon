"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import TwoPlayers, { sides } from "@/components/TwoPlayers";
import { C, H_COUNT, LINES, R, bestLine, over, play, score, start, type Level, type Side, type State } from "@/lib/dotsBoxes";

const STATS = "mm-dots";
type Rec = { won: number; lost: number };
const empty = (): Record<Level, Rec> => ({ easy: { won: 0, lost: 0 }, hard: { won: 0, lost: 0 } });
type Snap = { s: State; turn: Side; last: number | null };
const fresh = (): Snap => ({ s: start(), turn: 0, last: null });
const P = 0.5; // padding round the dots

/** Where a line sits on the board */
function ends(l: number) {
  if (l < H_COUNT) { const r = Math.floor(l / C), c = l % C; return { x1: c, y1: r, x2: c + 1, y2: r, label: `Across, row ${r + 1}, gap ${c + 1}` }; }
  const k = l - H_COUNT, r = Math.floor(k / (C + 1)), c = k % (C + 1);
  return { x1: c, y1: r, x2: c, y2: r + 1, label: `Down, column ${c + 1}, gap ${r + 1}` };
}

export default function SugarCubes() {
  const { toast } = useStore();
  const [level, setLevel] = useState<Level>("easy");
  const [g, setG] = useState<Snap>(fresh());
  const [history, setHistory] = useState<Snap[]>([]);
  const [stats, setStats] = useState(empty());
  const [recorded, setRecorded] = useState(false);
  const [two, setTwo] = useState(false);
  const [p1, p2] = sides(two);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (v) { setStats({ ...empty(), ...v.stats }); if (v.level === "hard") setLevel("hard"); } } catch {}
  }, []);
  function saveStats(next: Record<Level, Rec>, lv = level) { setStats(next); try { localStorage.setItem(STATS, JSON.stringify({ stats: next, level: lv })); } catch {} }
  const done = over(g.s);
  const me = score(g.s, 0), them = score(g.s, 1);
  useEffect(() => {
    if (g.turn !== 1 || done || two) return;
    const id = setTimeout(() => {
      const l = bestLine(g.s, level);
      const r = play(g.s, l, 1)!;
      setG({ s: r.state, turn: r.closed ? 1 : 0, last: l });
    }, 450);
    return () => clearTimeout(id);
  }, [g, level, done, two]);
  useEffect(() => {
    if (!done || recorded) return;
    setRecorded(true);
    const won = me > them;
    if (two) { toast(`${won ? p1 : p2} wins, ${Math.max(me, them)} to ${Math.min(me, them)}! 🧊🎉`); return; }
    saveStats({ ...stats, [level]: { ...stats[level], [won ? "won" : "lost"]: stats[level][won ? "won" : "lost"] + 1 } });
    toast(won ? `You win, ${me} to ${them}! 🧊🎉` : `The computer wins, ${them} to ${me}.`);
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  function draw(l: number) {
    if ((g.turn !== 0 && !two) || done || g.s.lines[l]) return;
    const side = g.turn;
    const r = play(g.s, l, side)!;
    setHistory([...history, g]);
    setG({ s: r.state, turn: r.closed ? side : side === 0 ? 1 : 0, last: l });
  }
  function newGame(lv = level, twoNow = two) {
    // Leaving a game halfway counts as a loss (not in a two-player game)
    if (!two && !done && history.length) saveStats({ ...stats, [level]: { ...stats[level], lost: stats[level].lost + 1 } }, lv);
    else if (lv !== level) saveStats(stats, lv);
    setLevel(lv); setTwo(twoNow); setG(fresh()); setHistory([]); setRecorded(false);
  }
  function undo() {
    // Go back to before your last line (and whatever the computer did after it)
    const prev = history[history.length - 1];
    if (prev) { setG(prev); setHistory(history.slice(0, -1)); }
  }
  const rec = stats[level];
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">a board game</p>
      <h1 className="h2">Sugar <em>cubes</em></h1>
      <p className="small muted">Dots and boxes against the computer. Take turns drawing a line between two dots. Draw the fourth side of a box and it&apos;s your sugar cube, and you go again. Most cubes when every line is drawn wins. Careful about drawing the third side of a box: that hands it over.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {!two && (["easy", "hard"] as const).map((lv) => <button key={lv} className={`chip ${level === lv ? "on" : ""}`} aria-pressed={level === lv} onClick={() => lv !== level && newGame(lv)}>{lv === "easy" ? "Easy" : "Hard"}</button>)}
        <TwoPlayers on={two} onChange={(v) => newGame(level, v)} />
        <button className="btn btn-ghost btn-sm" onClick={undo} disabled={!history.length || (g.turn !== 0 && !two) || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => newGame()}>New game</button>
      </div>
      <div className="rv-score" aria-live="polite">
        <span className={g.turn === 0 && !done ? "on" : ""}><i className="dr-mini you" /> {p1} <b>{me}</b></span>
        <span className="small muted">{done ? (two ? `${me > them ? p1 : p2} wins! 🎉` : me > them ? "You win! 🎉" : "Computer wins") : two ? `${g.turn === 0 ? p1 : p2}'s line` : g.turn === 0 ? "Your line" : "Thinking…"}</span>
        <span className={g.turn === 1 && !done ? "on" : ""}><b>{them}</b> {p2} <i className="dr-mini them" /></span>
      </div>
      <div className="sc-board">
        <svg viewBox={`${-P} ${-P} ${C + 2 * P} ${R + 2 * P}`} role="group" aria-label="Sugar cubes board">
          {g.s.owner.map((o, b) => o !== null && (
            <rect key={`b${b}`} className={`sc-box ${o ? "them" : "you"}`} x={(b % C) + 0.1} y={Math.floor(b / C) + 0.1} width={0.8} height={0.8} rx={0.12} />
          ))}
          {[...Array(LINES).keys()].map((l) => {
            const e = ends(l), on = g.s.lines[l];
            return (
              <g key={l} className={`sc-line ${on ? "on" : ""} ${g.last === l ? "last" : ""}`}
                role="button" tabIndex={on || (g.turn !== 0 && !two) || done ? -1 : 0} aria-label={`${e.label}${on ? ": drawn" : ""}`} aria-disabled={on || (g.turn !== 0 && !two) || done}
                onClick={() => draw(l)} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); draw(l); } }}>
                <line className="sc-hit" x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />
                <line className="sc-ink" x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />
              </g>
            );
          })}
          {[...Array(R + 1).keys()].flatMap((r) => [...Array(C + 1).keys()].map((c) => <circle key={`d${r},${c}`} className="sc-dot" cx={c} cy={r} r={0.09} />))}
        </svg>
      </div>
      {done && <p className="center"><button className="btn btn-pink btn-sm" onClick={() => newGame()}>Play again</button></p>}
      <p className="small muted" style={{ marginTop: "1rem" }}>{two ? "Two-player games don't count towards your record. " : ""}On {level}: won {rec.won} · lost {rec.lost}</p>
      <p className="tiny muted">There are {R * C} cubes, so there&apos;s always a winner. Easy gets careless. Hard never hands over a cube it doesn&apos;t have to, and knows when to leave you the last two of a row. Your record is kept on this device, and leaving a game halfway counts as a loss.</p>
    </div>
  );
}
