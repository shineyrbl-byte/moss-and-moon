"use client";
// More live boards: ludo for up to four (empty seats are computer players, moved by the host's device), and the
// hidden-hand games the server runs (poker, dominoes, café letters), which send actions rather than whole boards.
import { useEffect, useState } from "react";
import * as LU from "@/lib/ludo";
import * as PK from "@/lib/poker";
import * as DM from "@/lib/dominoes";
import * as CL from "@/lib/cafeLetters";

const Status = ({ text, sub }: { text: string; sub?: string }) => <p className="center small" aria-live="polite" style={{ margin: "0.8rem 0 0.4rem" }}><b>{text}</b>{sub ? <span className="muted"> · {sub}</span> : null}</p>;

// ----- Ludo -----
export type LudoState = { seat: number; started: boolean; humans: number; s: LU.State };
export const freshLudo = (): LudoState => ({ seat: 0, started: false, humans: 1, s: LU.newGame() });
const LCOL = ["#e391a8", "#8a5a40", "#9fae8d", "#e8b86a"], FACE = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const YARD: [number, number][] = [[0, 0], [0, 9], [9, 9], [9, 0]];
const spot = (p: number, t: number): [number, number] => [YARD[p][0] + 1.5 + Math.floor(t / 2) * 2, YARD[p][1] + 1.5 + (t % 2) * 2];
const homeSpot = (p: number, t: number): [number, number] => [6.6 + Math.floor(t / 2) * 0.9 + (p > 1 ? 0.4 : 0), 6.6 + (t % 2) * 0.9 + (p % 2 ? 0.4 : 0)];
/** Which device moves for each colour: the people who joined, then the host for the computer players */
const ownerOf = (st: LudoState, p: number) => (p < st.humans ? p : 0);
export function LiveLudo({ st, me, players, names, watching, send }: { st: LudoState; me: number | null; players: number; names: string[]; watching: boolean; send: (s: LudoState) => void }) {
  const [rolled, setRolled] = useState<LU.State | null>(null);
  const s = rolled ?? st.s, nameOf = (p: number) => (p < st.humans ? names[p] ?? `Player ${p + 1}` : ["", "Leela", "Omar", "Rosa"][p] + " (computer)");
  const mine = st.started && me !== null && ownerOf(st, s.turn) === me && s.winner === null;
  const humanTurn = s.turn < st.humans;
  useEffect(() => { setRolled(null); }, [st]);
  // The host's device plays the computer colours
  useEffect(() => {
    if (!mine || humanTurn) return;
    const id = setTimeout(() => {
      if (s.roll === null) { setRolled(LU.rollDie(s)); return; }
      const n = LU.move(s, LU.choose(s, "easy"));
      send({ ...st, s: n, seat: ownerOf(st, n.turn) });
    }, 700);
    return () => clearTimeout(id);
  }, [mine, humanTurn, s]); // eslint-disable-line react-hooks/exhaustive-deps
  // A roll with nothing to move passes on
  useEffect(() => {
    if (!mine || !humanTurn || s.roll === null || LU.movable(s).length) return;
    const id = setTimeout(() => { const n = LU.move(s, null); send({ ...st, s: n, seat: ownerOf(st, n.turn) }); }, 900);
    return () => clearTimeout(id);
  }, [mine, humanTurn, s]); // eslint-disable-line react-hooks/exhaustive-deps
  const can = mine && humanTurn ? LU.movable(s) : [];
  const where = (p: number, t: number): [number, number] => { const step = s.pos[p][t]; if (step === -1) return spot(p, t); if (step === LU.HOME) return homeSpot(p, t); const c = LU.cellOf(p, step)!; return [c[0] + 0.5, c[1] + 0.5]; };
  const kind = (r: number, c: number) => {
    const k = LU.TRACK.findIndex(([a, b]) => a === r && b === c);
    if (k >= 0) { const owner = LU.STARTS.indexOf(k); return { cls: `lu-track ${LU.SAFE.has(k) ? "safe" : ""}`, colour: owner >= 0 ? LCOL[owner] : undefined }; }
    for (let p = 0; p < LU.PLAYERS; p++) if (LU.LANES[p].some(([a, b]) => a === r && b === c)) return { cls: "lu-lane", colour: LCOL[p] };
    if (r >= 6 && r <= 8 && c >= 6 && c <= 8) return { cls: "lu-home" };
    for (let p = 0; p < LU.PLAYERS; p++) if (r >= YARD[p][0] && r < YARD[p][0] + 6 && c >= YARD[p][1] && c < YARD[p][1] + 6) return { cls: "lu-yard", colour: LCOL[p] };
    return { cls: "" };
  };
  if (!st.started) {
    return (
      <>
        <Status text={me === 0 ? `${players} at the table` : "Waiting for the host to start…"} sub={me === 0 ? "start when everyone's in; empty colours are computer players" : undefined} />
        <p className="center small">{names.slice(0, players).map((n, i) => <span key={i} style={{ marginRight: "0.6rem" }}><i className="dr-mini" style={{ background: LCOL[i] }} /> {n}</span>)}</p>
        {me === 0 && <p className="center"><button className="btn btn-pink" onClick={() => send({ ...st, started: true, humans: players, seat: 0 })} disabled={players < 2}>Start the game</button></p>}
      </>
    );
  }
  const text = s.winner !== null ? (s.winner === me ? "All four home: you win! 🎲🎉" : `${nameOf(s.winner)} wins`) : watching ? `${nameOf(s.turn)}'s turn` : mine && humanTurn ? (s.roll === null ? "Your roll" : can.length ? `You rolled a ${s.roll}: pick a counter` : `A ${s.roll}: nothing can move`) : `${nameOf(s.turn)}${s.roll ? ` rolled a ${s.roll}` : "'s turn"}`;
  return (
    <>
      <Status text={text} sub={me !== null && me < st.humans ? `you're ${["pink", "brown", "green", "yellow"][me]}` : undefined} />
      <p className="center"><span className="lu-die" aria-hidden="true">{s.roll ? FACE[s.roll] : ""}</span></p>
      <div className="lu-board" role="group" aria-label="Ludo board">
        {[...Array(225).keys()].map((i) => { const r = Math.floor(i / 15), c = i % 15, k = kind(r, c); return <span key={i} className={`lu-sq ${k.cls}`} style={k.colour ? { background: k.cls.includes("yard") ? `color-mix(in srgb, ${k.colour} 30%, var(--surface))` : k.colour } : undefined}>{k.cls.includes("safe") ? "★" : ""}</span>; })}
        {s.pos.flatMap((ps, p) => ps.map((step, t) => {
          const [r, c] = where(p, t), ok = p === s.turn && can.includes(t);
          const twin = s.pos[p].slice(0, t).filter((x) => x === step && step >= 0 && step < LU.HOME).length;
          return <button key={`${p}-${t}`} className={`lu-token ${ok ? "can" : ""}`} disabled={!ok} style={{ top: `${(r / 15) * 100}%`, left: `${(c / 15) * 100}%`, background: LCOL[p], transform: `translate(calc(-50% + ${twin * 4}px), calc(-50% - ${twin * 4}px))` }}
            onClick={() => { const n = LU.move(s, t); send({ ...st, s: n, seat: ownerOf(st, n.turn) }); }} aria-label={`${nameOf(p)}'s counter ${t + 1}${ok ? ", tap to move" : ""}`} />;
        }))}
      </div>
      {mine && humanTurn && s.roll === null && <p className="center" style={{ marginTop: "0.6rem" }}><button className="btn btn-pink" onClick={() => setRolled(LU.rollDie(s))}>🎲 Roll</button></p>}
    </>
  );
}

// ----- Hidden-hand games: the server sends a view with other players' cards as null -----
type Act = (action: Record<string, unknown>) => void;
const RANK = ["", "", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"], SUITS = ["♠", "♥", "♦", "♣"];
const PCard = ({ c }: { c: PK.Card | null }) => (c ? <span className={`pk-card ${c.s === 1 || c.s === 2 ? "red" : ""}`}><b>{RANK[c.r]}</b>{SUITS[c.s]}</span> : <span className="pk-card down" />);
type PokerView = { started: boolean; players: number; h: (Omit<PK.Hand, "seats"> & { seats: (Omit<PK.Seat, "cards"> & { cards: (PK.Card | null)[] })[] }) | null; over: boolean };
export function LivePoker({ st, me, names, act }: { st: PokerView; me: number | null; names: string[]; act: Act }) {
  const [to, setTo] = useState(0);
  const h = st.h, myTurn = !!h && !h.result && me !== null && h.turn === me;
  useEffect(() => { if (h && myTurn) setTo(PK.raiseRange(h as unknown as PK.Hand).min); }, [myTurn, h?.street]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!st.started || !h) return (
    <>
      <Status text={me === 0 ? `${st.players} at the table` : "Waiting for the host to deal…"} sub="everyone starts with 1000 chips" />
      <p className="center small">{names.slice(0, st.players).join(" · ")}</p>
      {me === 0 && <p className="center"><button className="btn btn-pink" onClick={() => act({ type: "deal" })} disabled={st.players < 2}>Deal the first hand</button></p>}
    </>
  );
  const owe = myTurn ? PK.toCall(h as unknown as PK.Hand) : 0, range = myTurn ? PK.raiseRange(h as unknown as PK.Hand) : { min: 0, max: 0 }, meSeat = me !== null ? h.seats[me] : null;
  const potNow = h.seats.reduce((n, s) => n + s.total, 0);
  // Name the winners with the table's names, not the computer game's
  const resultText = h.result ? `${h.result.winners.map((w) => names[w] ?? `Player ${w + 1}`).join(" and ")} ${h.result.winners.length > 1 ? "split" : "win" + (h.result.winners[0] === me ? "" : "s")} ${h.result.winners.length > 1 ? "the pot" : h.result.won[h.result.winners[0]]}` : "";
  return (
    <>
      <div className="pk-table">
        <div className="pk-others">
          {h.seats.map((s, i) => (i === me || s.out ? null : (
            <div key={i} className={`pk-seat ${h.turn === i && !h.result ? "on" : ""} ${s.folded ? "folded" : ""} ${h.result?.winners.includes(i) ? "won" : ""}`}>
              <div className="pk-name">{names[i] ?? `Player ${i + 1}`}{h.dealer === i && <span className="pk-button">D</span>}</div>
              <div className="pk-cards">{s.cards.map((c, k) => <PCard key={k} c={c} />)}</div>
              <div className="pk-chips">🪙 {s.chips}{s.bet ? <span className="pk-bet"> · in {s.bet}</span> : null}</div>
              <div className="pk-last small muted">{s.last}</div>
            </div>
          )))}
        </div>
        <div className="pk-board"><div className="pk-cards">{[0, 1, 2, 3, 4].map((k) => <PCard key={k} c={h.board[k] ?? null} />)}</div><div className="pk-pot">Pot <b>{potNow}</b></div></div>
        {meSeat && <div className={`pk-seat ${myTurn ? "on" : ""} ${meSeat.folded ? "folded" : ""}`}><div className="pk-name">You{h.dealer === me && <span className="pk-button">D</span>}</div><div className="pk-cards">{meSeat.cards.map((c, k) => <PCard key={k} c={c} />)}</div><div className="pk-chips">🪙 {meSeat.chips}</div></div>}
      </div>
      <Status text={h.result ? resultText : myTurn ? (owe ? `${owe} to call` : "Your move") : `${names[h.turn] ?? "Someone"} is thinking…`} />
      {myTurn && (
        <div className="pk-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => act({ type: "fold" })}>Fold</button>
          <button className="btn btn-ghost btn-sm" onClick={() => act({ type: owe ? "call" : "check" })}>{owe ? `Call ${owe}` : "Check"}</button>
          {range.max > h.toMatch && <><input type="range" min={range.min} max={range.max} step={10} value={Math.min(range.max, Math.max(range.min, to))} onChange={(e) => setTo(Number(e.target.value))} aria-label="Raise to" /><button className="btn btn-pink btn-sm" onClick={() => act({ type: "raise", to })}>{to >= range.max ? "All in" : `Raise to ${to}`}</button></>}
        </div>
      )}
      {h.result && !st.over && me !== null && <p className="center"><button className="btn btn-pink btn-sm" onClick={() => act({ type: "next" })}>Next hand</button></p>}
    </>
  );
}
type DomView = { r: Omit<DM.Round, "hands" | "boneyard"> & { hands: (DM.Tile | null)[][]; boneyard: null[] }; match: [number, number]; over: boolean };
const Bone = ({ t }: { t: DM.Tile | null }) => <span className={`ld-bone ${t ? "" : "down"}`}>{t ? `${t[0]}|${t[1]}` : ""}</span>;
export function LiveDominoes({ st, me, names, act }: { st: DomView; me: number | null; names: string[]; act: Act }) {
  const r = st.r, mine = me !== null && r.turn === me && r.winner === null, hand = me !== null ? (r.hands[me] as DM.Tile[]) : [];
  const ends = r.line.length ? [r.line[0][0], r.line[r.line.length - 1][1]] : null;
  const fits = (t: DM.Tile) => (!ends ? ["right"] : [...(t.includes(ends[0]) ? ["left"] : []), ...(t.includes(ends[1]) ? ["right"] : [])]) as ("left" | "right")[];
  const canPlay = hand.some((t) => fits(t).length);
  const other = me === 0 ? 1 : 0;
  return (
    <>
      <Status text={st.over ? `${st.match[0] > st.match[1] ? names[0] : names[1]} wins the match!` : r.winner !== null ? `${names[r.winner]} wins the round` : mine ? (canPlay ? "Your turn: tap a tile" : r.boneyard.length ? "Nothing fits: draw" : "Nothing fits: pass") : `${names[r.turn] ? `${names[r.turn]}'s` : "Their"} turn…`} sub={`${names[0]} ${st.match[0]} · ${names[1] ?? "?"} ${st.match[1]} · to ${DM.TARGET}`} />
      <p className="center">{(r.hands[other] ?? []).map((t, k) => <Bone key={k} t={t} />)}</p>
      <div className="ld-line">{r.line.map((t, k) => <Bone key={k} t={t} />)}{!r.line.length && <span className="small muted">The table&apos;s empty</span>}</div>
      <p className="center">{hand.map((t, k) => { const f = mine ? fits(t) : []; return <span key={k} className="ld-pick">{f.length ? f.map((end) => <button key={end} className="btn btn-ghost btn-sm" onClick={() => act({ type: "play", tile: t, end })} aria-label={`Play ${t[0]} ${t[1]} on the ${end}`}>{f.length > 1 ? (end === "left" ? "◀" : "▶") : ""}<Bone t={t} /></button>) : <Bone t={t} />}</span>; })}</p>
      <p className="center">{mine && !canPlay && <button className="btn btn-pink btn-sm" onClick={() => act({ type: "draw" })}>{r.boneyard.length ? "Draw" : "Pass"}</button>}{r.winner !== null && !st.over && <button className="btn btn-pink btn-sm" onClick={() => act({ type: "next" })}>Next round</button>}</p>
    </>
  );
}
type LetView = { g: Omit<CL.Game, "racks" | "bag"> & { racks: (string | null)[][]; bag: null[] }; over: boolean };
export function LiveLetters({ st, me, names, act }: { st: LetView; me: number | null; names: string[]; act: Act }) {
  const g = st.g, mine = me !== null && g.turn === me && !g.over, rack = me !== null ? (g.racks[me] as string[]) : [];
  const [placed, setPlaced] = useState<{ at: number; k: number }[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => { setPlaced([]); setSel(null); }, [g.turn, g.board.join("")]);
  const move = placed.map((p) => ({ at: p.at, letter: rack[p.k] })), preview = placed.length ? CL.evaluate(g.board, move) : null;
  const inRack = rack.map((_, k) => k).filter((k) => !placed.some((p) => p.k === k));
  function tap(i: number) {
    if (!mine) return;
    const p = placed.find((x) => x.at === i);
    if (p) return setPlaced(placed.filter((x) => x !== p));
    if (g.board[i] || sel === null) return;
    setPlaced([...placed, { at: i, k: sel }]); setSel(inRack.filter((k) => k !== sel)[0] ?? null);
  }
  return (
    <>
      <Status text={g.over ? `${g.scores[0] === g.scores[1] ? "A draw" : `${names[g.scores[0] > g.scores[1] ? 0 : 1]} wins`}, ${g.scores[0]}–${g.scores[1]}` : mine ? "Your turn" : `${names[g.turn] ? `${names[g.turn]}'s` : "Their"} turn…`} sub={`${names[0]} ${g.scores[0]} · ${names[1] ?? "?"} ${g.scores[1]} · ${g.bag.length} in the bag`} />
      <div className="cl-board" role="grid" aria-label="Board">
        {g.board.map((l, i) => { const p = placed.find((x) => x.at === i), letter = l || (p ? rack[p.k] : ""), pr = CL.PREMIUM[i]; return (
          <button key={i} className={`cl-sq ${pr ?? ""} ${letter ? "tile" : ""} ${p ? "new" : ""}`} onClick={() => tap(i)} disabled={!mine} aria-label={letter ? letter.toUpperCase() : "empty"}>
            {letter ? <><span className="cl-l">{letter.toUpperCase()}</span><span className="cl-v">{CL.VALUE[letter]}</span></> : i === CL.CENTRE ? "★" : pr ? <span className="cl-p">{({ dl: "2L", tl: "3L", dw: "2W", tw: "3W" } as Record<string, string>)[pr]}</span> : null}
          </button>); })}
      </div>
      <div className="cl-rack">{inRack.map((k) => <button key={k} className={`cl-tile ${sel === k ? "on" : ""}`} disabled={!mine} onClick={() => setSel(k)}><span className="cl-l">{rack[k].toUpperCase()}</span><span className="cl-v">{CL.VALUE[rack[k]]}</span></button>)}</div>
      {mine && <div className="row" style={{ justifyContent: "center", gap: "0.4rem" }}>
        <button className="btn btn-pink btn-sm" disabled={!placed.length} onClick={() => act({ type: "word", move })}>Play{preview?.ok ? ` ${preview.points}` : ""}</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setPlaced([])} disabled={!placed.length}>Take back</button>
        <button className="btn btn-ghost btn-sm" onClick={() => act({ type: "pass", swap: [] })}>Pass</button>
      </div>}
      {preview && !preview.ok && <p className="center tiny muted">{preview.why}</p>}
    </>
  );
}
/** Is a room's game finished? (for the rematch button) */
export function roomOver(game: string, state: Record<string, unknown>): boolean {
  if (state.over) return true;
  if (game === "ludo") return (state as unknown as LudoState).s.winner !== null;
  return false;
}
