"use client";
import "./page.css";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import { TARGET, bestMove, canPlay, deal, drawOrPass, ends, fits, handPips, play, roundPoints, same, type Level, type Round, type Tile } from "@/lib/dominoes";
import { addFlag } from "@/lib/trophyFlags";

const STATS = "mm-dominoes";
type Rec = { won: number; lost: number };
const DOTS: Record<number, [number, number][]> = { 0: [], 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[25, 25], [50, 50], [75, 75]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]], 6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]] };

// A tile, drawn across (in a line) or upright (in a hand, and doubles in the line)
function Domino({ t, down, vertical }: { t: Tile; down?: boolean; vertical?: boolean }) {
  const half = (n: number, off: number) => DOTS[n].map(([x, y], i) => <circle key={`${off}-${i}`} cx={vertical ? x : off + x} cy={vertical ? off + y : y} r={9} className="dm-dot" />);
  return (
    <svg viewBox={vertical ? "0 0 100 200" : "0 0 200 100"} className={`dm-tile ${vertical ? "v" : ""} ${down ? "down" : ""}`} aria-hidden="true">
      <rect x={2} y={2} width={vertical ? 96 : 196} height={vertical ? 196 : 96} rx={14} className="dm-face" />
      {!down && <>{vertical ? <line x1={12} y1={100} x2={88} y2={100} className="dm-mid" /> : <line x1={100} y1={12} x2={100} y2={88} className="dm-mid" />}{half(t[0], 0)}{half(t[1], 100)}</>}
    </svg>
  );
}

export default function CafeDominoes() {
  const { toast } = useStore();
  const [level, setLevel] = useState<Level>("easy");
  const [r, setR] = useState<Round | null>(null);
  const [match, setMatch] = useState<[number, number]>([0, 0]);
  const [pick, setPick] = useState<Tile | null>(null);
  const [stats, setStats] = useState<Record<Level, Rec>>({ easy: { won: 0, lost: 0 }, hard: { won: 0, lost: 0 } });
  const [scored, setScored] = useState(false);
  const youLacked = useRef<number[]>([]);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (v) { setStats({ easy: { won: 0, lost: 0 }, hard: { won: 0, lost: 0 }, ...v.stats }); if (v.level === "hard") setLevel("hard"); } } catch {}
    setR(deal(Math.random));
  }, []);
  function saveStats(next: Record<Level, Rec>, lv = level) { setStats(next); try { localStorage.setItem(STATS, JSON.stringify({ stats: next, level: lv })); } catch {} }
  // The computer's turn: play if it can, otherwise draw (one at a time, so you can see it) or pass
  useEffect(() => {
    if (!r || r.turn !== 1 || r.winner !== null) return;
    const id = setTimeout(() => {
      const m = bestMove(r, level, Math.random, youLacked.current);
      if (m) setR(play(r, m.tile, m.end)!);
      else { const n = drawOrPass(r); if (!r.boneyard.length) toast("The computer can't go, and passes."); setR(n); }
    }, r.drew ? 350 : 700);
    return () => clearTimeout(id);
  }, [r, level]); // eslint-disable-line react-hooks/exhaustive-deps
  // End of a round: score it, and the match if someone's reached the target
  useEffect(() => {
    if (!r || r.winner === null || scored) return;
    setScored(true);
    const pts = roundPoints(r), next: [number, number] = [...match] as [number, number];
    next[r.winner] += pts;
    setMatch(next);
    const why = r.blocked ? "Blocked! Fewest pips wins." : r.winner === 0 ? "You went out!" : "The computer went out.";
    if (next[r.winner] >= TARGET) {
      const won = r.winner === 0;
      if (won) addFlag(level === "hard" ? "dominoes-hard" : "dominoes-win");
      saveStats({ ...stats, [level]: { ...stats[level], [won ? "won" : "lost"]: stats[level][won ? "won" : "lost"] + 1 } });
      toast(won ? `You win the match, ${next[0]} to ${next[1]}! 🁫🎉` : `The computer takes the match, ${next[1]} to ${next[0]}.`);
    } else toast(`${why} ${r.winner === 0 ? "You score" : "The computer scores"} ${pts}.`);
  }, [r?.winner]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!r) return <div className="page"><p className="muted">Shuffling the tiles…</p></div>;
  const matchOver = match[0] >= TARGET || match[1] >= TARGET;
  function nextRound() { setR(deal(Math.random, r!.winner ?? 0)); setScored(false); setPick(null); youLacked.current = []; }
  function newMatch(lv = level) {
    if (!matchOver && (match[0] || match[1] || r!.line.length > 2)) saveStats({ ...stats, [level]: { ...stats[level], lost: stats[level].lost + 1 } }, lv);
    else if (lv !== level) saveStats(stats, lv);
    setLevel(lv); setMatch([0, 0]); setR(deal(Math.random)); setScored(false); setPick(null); youLacked.current = [];
  }
  const myTurn = r.turn === 0 && r.winner === null;
  function choose(t: Tile) {
    if (!myTurn) return;
    const where = fits(r!, t);
    if (!where.length) return toast("That one doesn't match either end.");
    if (where.length === 1 || (where.length === 2 && ends(r!)![0] === ends(r!)![1])) { setR(play(r!, t, where[0])!); setPick(null); return; }
    setPick(t);
  }
  function draw() {
    if (!myTurn || canPlay(r!, 0)) return;
    const e = ends(r!);
    if (e) youLacked.current = [...new Set([...youLacked.current, ...e])];
    setR(drawOrPass(r!));
  }
  const e = ends(r);
  const status = r.winner !== null ? (r.winner === 0 ? "You win the round" : "The computer wins the round") : !myTurn ? "The computer's thinking…" : !r.line.length ? "You lead: play any tile" : canPlay(r, 0) ? (pick ? "Which end?" : "Your turn: pick a tile that matches an end") : r.boneyard.length ? "Nothing matches: draw a tile" : "Nothing matches and the boneyard's empty: pass";
  return (
    <div className="page" style={{ maxWidth: "44rem" }}>
      <p className="eyebrow">a tile game</p>
      <h1 className="h2">Café <em>dominoes</em></h1>
      <p className="small muted">The draw game with a double-six set. Take turns adding a tile that matches the number at either end of the line. Can&apos;t go? Draw from the boneyard until you can. Go out first to score the pips left in the other hand; if nobody can move, the lower hand wins. First to {TARGET} takes the match.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {(["easy", "hard"] as const).map((lv) => <button key={lv} className={`chip ${level === lv ? "on" : ""}`} aria-pressed={level === lv} onClick={() => lv !== level && newMatch(lv)}>{lv === "easy" ? "Easy" : "Hard"}</button>)}
        <button className="btn btn-ghost btn-sm" onClick={() => newMatch()}>New match</button>
      </div>
      <div className="rv-score" aria-live="polite">
        <span className={r.turn === 0 && r.winner === null ? "on" : ""}>You <b>{match[0]}</b></span>
        <span className="small muted">to {TARGET} · boneyard {r.boneyard.length}</span>
        <span className={r.turn === 1 && r.winner === null ? "on" : ""}><b>{match[1]}</b> Computer</span>
      </div>
      <div className="dm-hand them" aria-label={`The computer has ${r.hands[1].length} tiles`}>{r.hands[1].map((t, k) => <Domino key={k} t={t} down={r.winner === null} vertical />)}</div>
      <div className="dm-line" aria-label={r.line.length ? `The line: ${r.line.map((t) => `${t[0]}-${t[1]}`).join(", ")}. Ends ${e![0]} and ${e![1]}` : "The line is empty"}>
        {pick && <button className="btn btn-pink btn-sm" onClick={() => { setR(play(r, pick, "left")!); setPick(null); }}>◀ Here ({e![0]})</button>}
        {r.line.map((t, k) => <span key={k} className={r.last && same(r.last.tile, t) && k === (r.last.end === "left" ? 0 : r.line.length - 1) ? "dm-new" : ""}><Domino t={t} vertical={t[0] === t[1]} /></span>)}
        {!r.line.length && <span className="small muted">The table&apos;s empty</span>}
        {pick && <button className="btn btn-pink btn-sm" onClick={() => { setR(play(r, pick, "right")!); setPick(null); }}>Here ({e![1]}) ▶</button>}
      </div>
      <p className="center small" style={{ margin: "0.6rem 0" }}><b>{status}</b></p>
      <div className="dm-hand mine" aria-label="Your tiles">
        {r.hands[0].map((t) => {
          const ok = myTurn && fits(r, t).length > 0;
          return <button key={`${t[0]}-${t[1]}`} className={`dm-btn ${ok ? "can" : ""} ${pick && same(pick, t) ? "sel" : ""}`} onClick={() => choose(t)} disabled={!myTurn} aria-label={`${t[0]} and ${t[1]}${ok ? ", fits" : ""}`}><Domino t={t} vertical /></button>;
        })}
      </div>
      <div className="row" style={{ justifyContent: "center", gap: "0.5rem", marginTop: "0.6rem" }}>
        {myTurn && !canPlay(r, 0) && <button className="btn btn-pink btn-sm" onClick={draw}>{r.boneyard.length ? "Draw a tile" : "Pass"}</button>}
        {r.winner !== null && !matchOver && <button className="btn btn-pink btn-sm" onClick={nextRound}>Next round</button>}
        {matchOver && <button className="btn btn-pink btn-sm" onClick={() => newMatch()}>Play another match</button>}
      </div>
      {r.winner !== null && <p className="center small muted">Left in hands: you {handPips(r.hands[0])} pips, the computer {handPips(r.hands[1])}.</p>}
      <p className="small muted" style={{ marginTop: "1rem" }}>On {level}: won {stats[level].won} · lost {stats[level].lost}</p>
      <p className="tiny muted">Easy plays whatever fits. Hard gets rid of heavy tiles early, keeps a spread of numbers, and remembers which numbers made you draw.</p>
    </div>
  );
}
