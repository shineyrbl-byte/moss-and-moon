"use client";
import "./page.css";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import TwoPlayers, { sides } from "@/components/TwoPlayers";
import { addFlag } from "@/lib/trophyFlags";
import { applyStep, bestPlay, end, finish, newGame, pips, plays, roll, winKind, winner, type Level, type State, type Step } from "@/lib/backgammon";

const STATS = "mm-backgammon";
type Rec = { won: number; lost: number };
const blank = (): Record<Level, Rec> => ({ easy: { won: 0, lost: 0 }, hard: { won: 0, lost: 0 } });
const FACE = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const KIND = ["", "a single game", "a gammon (double)", "a backgammon (triple)"];
const TOP = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24], BOTTOM = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const same = (a: Step, b: Step) => a.from === b.from && a.to === b.to && a.die === b.die;

export default function TerraceBackgammon() {
  const { toast } = useStore();
  const [level, setLevel] = useState<Level>("easy");
  const [s, setS] = useState<State>(newGame);
  const [turnStart, setTurnStart] = useState<State | null>(null);
  const [dice, setDice] = useState<[number, number] | null>(null);
  const [done, setDone] = useState<Step[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [theirs, setTheirs] = useState<{ dice: [number, number]; steps: Step[] } | null>(null);
  const [stats, setStats] = useState(blank());
  const [recorded, setRecorded] = useState(false);
  const [two, setTwo] = useState(false);
  const [p1, p2] = sides(two);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (v) { setStats({ ...blank(), ...v.stats }); if (v.level === "hard") setLevel("hard"); } } catch {}
  }, []);
  function saveStats(next: Record<Level, Rec>, lv = level) { setStats(next); try { localStorage.setItem(STATS, JSON.stringify({ stats: next, level: lv })); } catch {} }
  const w = winner(s);
  const human = s.turn === 0 || two;
  // The ways to finish your roll, given the moves you've already made
  const options = dice && turnStart ? plays(turnStart, dice, false).filter((p) => done.every((st, k) => p[k] && same(p[k], st))) : [];
  const next = options.map((p) => p[done.length]).filter(Boolean);
  const turnOver = !!dice && human && (options.length === 0 || options.every((p) => p.length === done.length));

  // The computer's turn
  useEffect(() => {
    if (s.turn !== 1 || w !== null || two) return;
    const id = setTimeout(() => {
      const d = roll();
      const p = bestPlay(s, d, level);
      setTheirs({ dice: d, steps: p });
      if (!p.length) toast("The computer can't move with that roll.");
      setS(finish(end(s, p)));
    }, 900);
    return () => clearTimeout(id);
  }, [s, level, w, two]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (w === null || recorded) return;
    setRecorded(true);
    const k = winKind(s, w);
    if (two) { toast(`${w === 0 ? p1 : p2} wins ${KIND[k]}! 🎲🎉`); return; }
    saveStats({ ...stats, [level]: { ...stats[level], [w === 0 ? "won" : "lost"]: stats[level][w === 0 ? "won" : "lost"] + 1 } });
    if (w === 0 && k > 1) addFlag("backgammon-gammon");
    toast(w === 0 ? `You win ${KIND[k]}! 🎲🎉` : `The computer wins ${KIND[k]}.`);
  }, [w]); // eslint-disable-line react-hooks/exhaustive-deps

  function doRoll() {
    if (!human || dice || w !== null) return;
    const d = roll();
    setDice(d); setTurnStart(s); setDone([]); setSel(null);
    if (!plays(s, d).some((p) => p.length)) toast(`${FACE[d[0]]} ${FACE[d[1]]}: no move possible. Tap “End turn”.`);
  }
  function endTurn() { setS(finish(s)); setDice(null); setTurnStart(null); setDone([]); setSel(null); }
  function tapPoint(i: number) {
    if (!human || !dice || w !== null) return;
    if (sel !== null) {
      const st = next.find((x) => x.from === sel && x.to === i);
      if (st) { setS(applyStep(s, s.turn, st)); setDone([...done, st]); setSel(null); return; }
    }
    if (next.some((x) => x.from === i)) setSel(sel === i ? null : i); else setSel(null);
  }
  function undoTurn() { if (turnStart) { setS(turnStart); setDone([]); setSel(null); } }
  function newGame2(lv = level, twoNow = two) {
    if (!two && w === null && (turnStart || s.off[0] || s.off[1] || theirs)) saveStats({ ...stats, [level]: { ...stats[level], lost: stats[level].lost + 1 } }, lv);
    else if (lv !== level) saveStats(stats, lv);
    setLevel(lv); setTwo(twoNow); setS(newGame()); setDice(null); setTurnStart(null); setDone([]); setSel(null); setTheirs(null); setRecorded(false);
  }
  const targets = new Set(sel === null ? [] : next.filter((x) => x.from === sel).map((x) => x.to));
  const movable = new Set(next.map((x) => x.from));
  // The dice faces for this roll, with the ones already used greyed out
  const faces = dice ? (dice[0] === dice[1] ? [dice[0], dice[0], dice[0], dice[0]] : [...dice]) : [];
  const usedLeft = done.map((d) => d.die);
  const faceUsed = faces.map((f) => { const k = usedLeft.indexOf(f); if (k < 0) return false; usedLeft.splice(k, 1); return true; });
  const Point = ({ i, top }: { i: number; top: boolean }) => {
    const v = s.pts[i], n = Math.abs(v), side = v > 0 ? "you" : "them";
    const theirMove = theirs?.steps.some((st) => st.to === i || st.from === i);
    return (
      <button className={`bg-pt ${top ? "top" : "bottom"} ${i % 2 ? "odd" : "even"} ${targets.has(i) ? "target" : ""} ${sel === i ? "sel" : ""} ${movable.has(i) && sel === null ? "can" : ""} ${theirMove && s.turn === 0 && !dice ? "theirs" : ""}`}
        onClick={() => tapPoint(i)} aria-label={`Point ${i}: ${n ? `${n} ${v > 0 ? (two ? "of Player 1's" : "of yours") : two ? "of Player 2's" : "of the computer's"}` : "empty"}${targets.has(i) ? ", move here" : ""}${movable.has(i) ? ", you can move from here" : ""}`}>
        <span className="bg-stack">
          {[...Array(Math.min(n, 5)).keys()].map((k) => <i key={k} className={`bg-ck ${side}`}>{k === 4 && n > 5 ? n : ""}</i>)}
        </span>
        <small className="bg-num" aria-hidden="true">{i}</small>
      </button>
    );
  };
  const who = two ? `${s.turn === 0 ? p1 : p2}: ` : "";
  const status = w !== null ? (two ? `${w === 0 ? p1 : p2} wins! 🎉` : w === 0 ? "You win! 🎉" : "The computer wins")
    : !human ? "The computer is rolling…" : who + (!dice ? "roll the dice" : turnOver ? "that's the roll used" : sel !== null ? "now pick where it goes" : s.bar[s.turn] ? "bring the checker in from the bar first" : "pick a checker to move");
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">a board game</p>
      <h1 className="h2">Terrace <em>backgammon</em></h1>
      <p className="small muted">You&apos;re pink and race your fifteen checkers round to your home in the bottom right, then bear them off. Each die moves one checker that many points; a double is played four times. You can&apos;t land where the computer has two or more, but land on a single one and it goes to the bar and has to start again. Use as much of each roll as you can.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {!two && (["easy", "hard"] as const).map((lv) => <button key={lv} className={`chip ${level === lv ? "on" : ""}`} aria-pressed={level === lv} onClick={() => lv !== level && newGame2(lv)}>{lv === "easy" ? "Easy" : "Hard"}</button>)}
        <TwoPlayers on={two} onChange={(v) => newGame2(level, v)} />
        <button className="btn btn-ghost btn-sm" onClick={() => newGame2()}>New game</button>
      </div>
      <div className="rv-score">
        <span className={s.turn === 0 && w === null ? "on" : ""}><i className="dr-mini you" /> {p1} · {pips(s, 0)} to go · {s.off[0]} off</span>
        <span className={s.turn === 1 && w === null ? "on" : ""}>{s.off[1]} off · {pips(s, 1)} to go · {p2} <i className="dr-mini them" /></span>
      </div>
      <p className="center small" aria-live="polite" style={{ margin: "0.2rem 0 0.4rem" }}><b>{status}</b>{theirs && s.turn === 0 && !dice ? <span className="muted"> · they rolled {FACE[theirs.dice[0]]} {FACE[theirs.dice[1]]}</span> : null}</p>
      <div className="bg-board">
        <div className="bg-row">{TOP.slice(0, 6).map((i) => <Point key={i} i={i} top />)}<span className="bg-bar" aria-hidden="true" />{TOP.slice(6).map((i) => <Point key={i} i={i} top />)}</div>
        <div className="bg-mid">
          <button className={`bg-barbox ${movable.has(25) && s.turn === 0 ? "can" : ""} ${sel === 25 && s.turn === 0 ? "sel" : ""}`} onClick={() => s.turn === 0 && tapPoint(25)} aria-label={`${two ? "Player 1's" : "Your"} bar: ${s.bar[0]}`}>{s.bar[0] ? <><i className="bg-ck you" /> ×{s.bar[0]}</> : null}</button>
          <span className="bg-dice" aria-label={dice ? `Your dice: ${dice.join(" and ")}` : undefined}>{faces.map((f, k) => <b key={k} className={faceUsed[k] ? "used" : ""}>{FACE[f]}</b>)}</span>
          <button className={`bg-barbox them ${movable.has(0) && s.turn === 1 ? "can" : ""} ${sel === 0 && s.turn === 1 ? "sel" : ""}`} onClick={() => s.turn === 1 && tapPoint(0)} aria-label={`${two ? "Player 2's" : "The computer's"} bar: ${s.bar[1]}`}>{s.bar[1] ? <><i className="bg-ck them" /> ×{s.bar[1]}</> : null}</button>
        </div>
        <div className="bg-row">{BOTTOM.slice(0, 6).map((i) => <Point key={i} i={i} top={false} />)}<span className="bg-bar" aria-hidden="true" />{BOTTOM.slice(6).map((i) => <Point key={i} i={i} top={false} />)}</div>
        {two && <button className={`bg-off them ${s.turn === 1 && targets.has(25) ? "target" : ""}`} onClick={() => s.turn === 1 && tapPoint(25)} aria-label={`Player 2 bears off here. ${s.off[1]} off so far.`}>↗ Off {s.off[1]}</button>}
        <button className={`bg-off ${s.turn === 0 && targets.has(0) ? "target" : ""}`} onClick={() => s.turn === 0 && tapPoint(0)} aria-label={`Bear off here${targets.has(0) ? ", you can bear off" : ""}. ${s.off[0]} off so far.`}>Off ↘ {s.off[0]}</button>
      </div>
      <div className="row" style={{ justifyContent: "center", gap: "0.5rem", marginTop: "0.6rem" }}>
        {!dice && human && w === null && <button className="btn btn-pink" onClick={doRoll}>🎲 Roll{two ? ` for ${s.turn === 0 ? p1 : p2}` : ""}</button>}
        {dice && <button className="btn btn-ghost btn-sm" onClick={undoTurn} disabled={!done.length}>↩ Undo this turn</button>}
        {dice && <button className="btn btn-pink btn-sm" onClick={endTurn} disabled={!turnOver}>End turn</button>}
        {w !== null && <button className="btn btn-pink btn-sm" onClick={() => newGame2()}>Play again</button>}
      </div>
      <p className="small muted" style={{ marginTop: "1rem" }}>{two ? "Two-player games don't count towards your record. Player 2 (brown) enters from their bar and bears off at the top right. " : ""}On {level}: won {stats[level].won} · lost {stats[level].lost}</p>
      <p className="tiny muted">Win before the computer bears off any checkers for a gammon, and while it still has one on the bar or in your home for a backgammon. &quot;To go&quot; is how many points each side still has to travel. The computer&apos;s last move is outlined. Your record is kept on this device.</p>
    </div>
  );
}
