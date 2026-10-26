"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { HOME, LANES, PLAYERS, SAFE, STARTS, TRACK, cellOf, choose, movable, move, newGame, rollDie, type Level, type State } from "@/lib/ludo";
import { addFlag } from "@/lib/trophyFlags";

const STATS = "mm-ludo";
const NAMES = ["You", "Leela", "Omar", "Rosa"];
const COLOURS = ["#e391a8", "#8a5a40", "#9fae8d", "#e8b86a"];
const FACE = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
// Each player's yard (a 6×6 corner) and the four spots in it
const YARD: [number, number][] = [[0, 0], [0, 9], [9, 9], [9, 0]];
const spot = (p: number, t: number): [number, number] => [YARD[p][0] + 1.5 + Math.floor(t / 2) * 2, YARD[p][1] + 1.5 + (t % 2) * 2];
const homeSpot = (p: number, t: number): [number, number] => [6.6 + Math.floor(t / 2) * 0.9 + (p > 1 ? 0.4 : 0), 6.6 + (t % 2) * 0.9 + (p % 2 ? 0.4 : 0)];

export default function CafeLudo() {
  const { toast } = useStore();
  const [level, setLevel] = useState<Level>("easy");
  const [s, setS] = useState<State>(newGame);
  const [stats, setStats] = useState({ won: 0, played: 0 });
  const [recorded, setRecorded] = useState(false);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (v) { setStats({ won: v.won ?? 0, played: v.played ?? 0 }); if (v.level === "hard") setLevel("hard"); } } catch {}
  }, []);
  function saveStats(n: { won: number; played: number }, lv = level) { setStats(n); try { localStorage.setItem(STATS, JSON.stringify({ ...n, level: lv })); } catch {} }
  // Computer players roll and move by themselves
  useEffect(() => {
    if (s.winner !== null || s.turn === 0) return;
    const id = setTimeout(() => {
      if (s.roll === null) setS(rollDie(s));
      else setS(move(s, choose(s, level)));
    }, s.roll === null ? 500 : 650);
    return () => clearTimeout(id);
  }, [s, level]);
  // Your roll with nothing to move passes on by itself
  useEffect(() => {
    if (s.turn !== 0 || s.roll === null || movable(s).length) return;
    const id = setTimeout(() => { toast(`A ${s.roll}: nothing can move.`); setS(move(s, null)); }, 900);
    return () => clearTimeout(id);
  }, [s]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (s.winner === null || recorded) return;
    setRecorded(true);
    const won = s.winner === 0;
    if (won) addFlag("ludo-win");
    saveStats({ won: stats.won + (won ? 1 : 0), played: stats.played + 1 });
    toast(won ? "All four home: you win! 🎲🎉" : `${NAMES[s.winner]} got all four home first.`);
  }, [s.winner]); // eslint-disable-line react-hooks/exhaustive-deps
  function newGame2(lv = level) { setLevel(lv); setS(newGame()); setRecorded(false); if (lv !== level) saveStats(stats, lv); }
  const can = s.turn === 0 ? movable(s) : [];
  const where = (p: number, t: number): [number, number] => { const step = s.pos[p][t]; if (step === -1) return spot(p, t); if (step === HOME) return homeSpot(p, t); const c = cellOf(p, step)!; return [c[0] + 0.5, c[1] + 0.5]; };
  // What each of the 225 squares is
  const kind = (r: number, c: number) => {
    const k = TRACK.findIndex(([a, b]) => a === r && b === c);
    if (k >= 0) { const owner = STARTS.indexOf(k); return { cls: `lu-track ${SAFE.has(k) ? "safe" : ""}`, colour: owner >= 0 ? COLOURS[owner] : undefined }; }
    for (let p = 0; p < PLAYERS; p++) if (LANES[p].some(([a, b]) => a === r && b === c)) return { cls: "lu-lane", colour: COLOURS[p] };
    if (r >= 6 && r <= 8 && c >= 6 && c <= 8) return { cls: "lu-home" };
    for (let p = 0; p < PLAYERS; p++) if (r >= YARD[p][0] && r < YARD[p][0] + 6 && c >= YARD[p][1] && c < YARD[p][1] + 6) return { cls: "lu-yard", colour: COLOURS[p] };
    return { cls: "" };
  };
  const status = s.winner !== null ? (s.winner === 0 ? "You win! 🎉" : `${NAMES[s.winner]} wins`) : s.turn === 0 ? (s.roll === null ? "Your roll" : can.length ? `You rolled a ${s.roll}: pick a counter` : `You rolled a ${s.roll}`) : `${NAMES[s.turn]}${s.roll ? ` rolled a ${s.roll}` : " is rolling…"}`;
  return (
    <div className="page" style={{ maxWidth: "36rem" }}>
      <p className="eyebrow">a board game</p>
      <h1 className="h2">Café <em>ludo</em></h1>
      <p className="small muted">Race your four pink counters round the board and up your lane to the middle, against Leela, Omar and Rosa. Roll a 6 to bring a counter out. Land on someone and they go back to their yard, except on the starred safe squares. A 6, a capture or getting a counter home earns another roll, and you need the exact number to finish.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {(["easy", "hard"] as const).map((lv) => <button key={lv} className={`chip ${level === lv ? "on" : ""}`} aria-pressed={level === lv} onClick={() => lv !== level && newGame2(lv)}>{lv === "easy" ? "Easy" : "Hard"}</button>)}
        <button className="btn btn-ghost btn-sm" onClick={() => newGame2()}>New game</button>
      </div>
      <p className="center small" aria-live="polite" style={{ margin: "0.6rem 0 0.4rem" }}><b>{status}</b> <span className="lu-die" aria-hidden="true">{s.roll ? FACE[s.roll] : ""}</span></p>
      <div className="lu-board" role="group" aria-label="Ludo board">
        {[...Array(225).keys()].map((i) => { const r = Math.floor(i / 15), c = i % 15, k = kind(r, c); return <span key={i} className={`lu-sq ${k.cls}`} style={k.colour ? { background: k.cls.includes("yard") ? `color-mix(in srgb, ${k.colour} 30%, var(--surface))` : k.colour } : undefined}>{k.cls.includes("safe") ? "★" : ""}</span>; })}
        {s.pos.flatMap((ps, p) => ps.map((step, t) => {
          const [r, c] = where(p, t), mine = p === 0 && can.includes(t);
          // Counters sharing a square shift a little so you can see them all
          const twin = s.pos[p].slice(0, t).filter((x) => x === step && step >= 0 && step < HOME).length;
          return (
            <button key={`${p}-${t}`} className={`lu-token ${mine ? "can" : ""} ${s.last?.p === p && s.last.t === t ? "last" : ""}`} disabled={!mine}
              style={{ top: `${(r / 15) * 100}%`, left: `${(c / 15) * 100}%`, background: COLOURS[p], transform: `translate(calc(-50% + ${twin * 4}px), calc(-50% - ${twin * 4}px))` }}
              onClick={() => setS(move(s, t))} aria-label={`${NAMES[p]}'s counter ${t + 1}: ${step === -1 ? "in the yard" : step === HOME ? "home" : step > 50 ? "in the home lane" : `${step} squares along`}${mine ? ", tap to move" : ""}`} />
          );
        }))}
      </div>
      <div className="row" style={{ justifyContent: "center", marginTop: "0.6rem" }}>
        {s.turn === 0 && s.roll === null && s.winner === null && <button className="btn btn-pink" onClick={() => setS(rollDie(s))}>🎲 Roll</button>}
        {s.winner !== null && <button className="btn btn-pink btn-sm" onClick={() => newGame2()}>Play again</button>}
      </div>
      <p className="small muted" style={{ marginTop: "1rem" }}>Won {stats.won} of {stats.played} on this device.</p>
      <p className="tiny muted">Easy players move any counter; hard ones chase captures and keep out of reach. It&apos;s mostly the luck of the dice.</p>
    </div>
  );
}
