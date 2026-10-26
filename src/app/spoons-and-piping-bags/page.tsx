"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { BAGS, LAST, SPOONS, cellOf, newGame, take, type State } from "@/lib/snakesLadders";
import { addFlag } from "@/lib/trophyFlags";

const FACE = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const COLOURS = ["#e391a8", "#8a5a40", "#9fae8d", "#e8b86a"];
const centre = (n: number) => { const [r, c] = cellOf(n); return [c + 0.5, r + 0.5]; };

export default function SpoonsAndPipingBags() {
  const { toast } = useStore();
  const [players, setPlayers] = useState(2);
  const [humans, setHumans] = useState(1); // 1: you against the computer(s); 2+: everyone takes turns on this device
  const [s, setS] = useState<State>(() => newGame(2));
  const names = [...Array(players).keys()].map((p) => (p < humans ? (humans === 1 ? "You" : `Player ${p + 1}`) : ["Leela", "Omar", "Rosa"][p - humans] ?? "Computer"));
  const human = s.turn < humans;
  function roll() { if (s.winner === null) { const r = 1 + Math.floor(Math.random() * 6); const n = take(s, r); if (n.note) toast(`${names[s.turn]} ${n.note}`); setS(n); } }
  useEffect(() => {
    if (s.winner !== null || human) return;
    const id = setTimeout(roll, 800);
    return () => clearTimeout(id);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (s.winner === null) return;
    if (s.winner === 0 && humans === 1) addFlag("spoons-win");
    toast(`${names[s.winner]} reached ${LAST}! 🥄🎉`);
  }, [s.winner]); // eslint-disable-line react-hooks/exhaustive-deps
  function setup(p: number, h: number) { setPlayers(p); setHumans(h); setS(newGame(p)); }
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">a board game</p>
      <h1 className="h2">Spoons &amp; <em>piping bags</em></h1>
      <p className="small muted">Snakes and ladders, café style. Roll and move round the board from 1 to 100. Land at the bottom of a spoon 🥄 to climb up it; land on a piping bag&apos;s nozzle and you slide all the way down. A 6 gets another roll, and you need the exact number to land on 100. Pure luck, so anyone can win.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className={`chip ${humans === 1 && players === 2 ? "on" : ""}`} onClick={() => setup(2, 1)}>You vs the computer</button>
        <button className={`chip ${humans === 1 && players === 4 ? "on" : ""}`} onClick={() => setup(4, 1)}>You vs three</button>
        <button className={`chip ${humans === 2 ? "on" : ""}`} onClick={() => setup(2, 2)}>👥 Two players</button>
        <button className={`chip ${humans === 4 ? "on" : ""}`} onClick={() => setup(4, 4)}>👥 Four players</button>
      </div>
      <p className="center small" aria-live="polite" style={{ margin: "0.6rem 0 0.4rem" }}>
        <b>{s.winner !== null ? `${names[s.winner]} wins! 🎉` : `${names[s.turn]}'s turn`}</b>{s.roll ? <span className="lu-die" aria-label={`Last roll ${s.roll}`}> {FACE[s.roll]}</span> : null}
      </p>
      <div className="sl2-board" role="img" aria-label={`Board: ${names.map((n, p) => `${n} on ${s.pos[p] || "the start"}`).join(", ")}`}>
        {[...Array(100).keys()].map((k) => { const n = 100 - k, [r, c] = cellOf(n); return <span key={n} className={`sl2-sq ${(r + c) % 2 ? "odd" : ""}`} style={{ gridRow: r + 1, gridColumn: c + 1 }}>{n}</span>; })}
        <svg viewBox="0 0 10 10" aria-hidden="true">
          {Object.entries(SPOONS).map(([a, b]) => { const [x1, y1] = centre(+a), [x2, y2] = centre(b); return <g key={`s${a}`}><line x1={x1} y1={y1} x2={x2} y2={y2} className="sl2-spoon" /><ellipse cx={x2} cy={y2} rx={0.22} ry={0.3} className="sl2-bowl" /></g>; })}
          {Object.entries(BAGS).map(([a, b]) => { const [x1, y1] = centre(+a), [x2, y2] = centre(b); const mx = (x1 + x2) / 2 + 0.6, my = (y1 + y2) / 2; return <g key={`b${a}`}><path d={`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`} className="sl2-bag" /><circle cx={x1} cy={y1} r={0.14} className="sl2-nozzle" /></g>; })}
          {s.pos.map((n, p) => { if (!n) return null; const [x, y] = centre(n); return <circle key={p} cx={x - 0.18 + (p % 2) * 0.36} cy={y - 0.18 + Math.floor(p / 2) * 0.36} r={0.2} fill={COLOURS[p]} className="sl2-token" />; })}
        </svg>
      </div>
      <p className="center small" style={{ marginTop: "0.4rem" }}>{names.map((n, p) => <span key={p} style={{ marginRight: "0.8rem" }}><i className="dr-mini" style={{ background: COLOURS[p] }} /> {n}: {s.pos[p] || "start"}</span>)}</p>
      <div className="row" style={{ justifyContent: "center", marginTop: "0.4rem" }}>
        {s.winner === null && human && <button className="btn btn-pink" onClick={roll}>🎲 Roll{humans > 1 ? ` for ${names[s.turn]}` : ""}</button>}
        {s.winner !== null && <button className="btn btn-pink btn-sm" onClick={() => setS(newGame(players))}>Play again</button>}
      </div>
    </div>
  );
}
