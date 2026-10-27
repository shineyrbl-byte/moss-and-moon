"use client";
// Boards for live games in a room: reversi, draughts, Connect Four and backgammon. Each draws the board from the room's
// state, works out the status line, and calls send() with the next state (which says whose turn is next in `seat`).
import { useState } from "react";
import * as RV from "@/lib/reversi";
import * as DR from "@/lib/draughts";
import * as C4 from "@/lib/connect4";
import * as BG from "@/lib/backgammon";

export type Seat = 0 | 1;
type Props<S> = { st: S; me: Seat; joined: boolean; send: (s: S & { seat: Seat }) => void };
const Status = ({ text, sub }: { text: string; sub?: string }) => <p className="center small" aria-live="polite" style={{ margin: "0.8rem 0 0.4rem" }}><b>{text}</b>{sub ? <span className="muted"> · {sub}</span> : null}</p>;
const otherSeat = (s: Seat): Seat => (s === 0 ? 1 : 0);

// ----- Reversi: host is the dark beans (1) and goes first -----
export type ReversiState = { seat: Seat; b: RV.Board; last: number | null; over: boolean };
export const freshReversi = (): ReversiState => ({ seat: 0, b: RV.start(), last: null, over: false });
export function LiveReversi({ st, me, joined, send }: Props<ReversiState>) {
  const p = me === 0 ? 1 : 2, mine = st.seat === me && !st.over && joined;
  const moves = mine ? RV.legal(st.b, p) : [];
  const [a, b] = [RV.count(st.b, p), RV.count(st.b, RV.other(p))];
  const text = st.over ? (a > b ? `You win, ${a} to ${b}! 🎉` : a < b ? `Your friend wins, ${b} to ${a}` : "A draw!") : !joined ? "Waiting for your friend to join…" : mine ? "Your move" : "Their move…";
  function tap(i: number) {
    if (!moves.includes(i)) return;
    const nb = RV.play(st.b, i, p)!, nt = RV.nextTurn(nb, RV.other(p));
    send({ seat: nt === null ? st.seat : nt === 1 ? 0 : 1, b: nb, last: i, over: nt === null });
  }
  return (
    <>
      <Status text={text} sub={`you're ${p === 1 ? "the dark beans" : "the milk"} · ${a}–${b}`} />
      <div className="rv-board" role="grid" aria-label="Reversi board">
        {st.b.map((v, i) => (
          <button key={i} className={`rv-sq ${moves.includes(i) ? "can" : ""} ${st.last === i ? "last" : ""}`} onClick={() => tap(i)} disabled={!moves.includes(i)}
            aria-label={`Row ${Math.floor(i / RV.N) + 1}, column ${(i % RV.N) + 1}: ${v === p ? "yours" : v ? "theirs" : moves.includes(i) ? "you can play here" : "empty"}`}>
            {v > 0 && <i className={`rv-disc ${v === 1 ? "dark" : "light"}`} />}
          </button>
        ))}
      </div>
    </>
  );
}

// ----- Draughts: host is pink (1), at the bottom, and moves first; the guest sees the board turned round -----
export type DraughtsState = { seat: Seat; b: DR.Board; quiet: number; last: DR.Move | null; result: "won1" | "won2" | "drawn" | null };
export const freshDraughts = (): DraughtsState => ({ seat: 0, b: DR.start(), quiet: 0, last: null, result: null });
export function LiveDraughts({ st, me, joined, send }: Props<DraughtsState>) {
  const [sel, setSel] = useState<number | null>(null);
  const side: 1 | -1 = me === 0 ? 1 : -1, mine = st.seat === me && !st.result && joined;
  const moves = mine ? DR.moves(st.b, side) : [];
  const from = sel === null ? [] : moves.filter((m) => m.from === sel), targets = from.map((m) => m.path[m.path.length - 1]);
  const lastSq = st.last ? [st.last.from, ...st.last.path] : [];
  const iWon = (me === 0 && st.result === "won1") || (me === 1 && st.result === "won2");
  const text = st.result ? (st.result === "drawn" ? "A draw" : iWon ? "You win! 👑🎉" : "Your friend wins") : !joined ? "Waiting for your friend to join…" : mine ? (moves.some((m) => m.caps.length) ? "Your move: you must take" : "Your move") : "Their move…";
  function tap(i: number) {
    if (!mine) return;
    const m = from.find((x) => x.path[x.path.length - 1] === i);
    if (m) {
      const nb = DR.apply(st.b, m), quiet = DR.resets(st.b, m) ? 0 : st.quiet + 1;
      const theyCant = !DR.moves(nb, (-side) as 1 | -1).length;
      const result = theyCant ? (me === 0 ? "won1" : "won2") : quiet >= DR.DRAW_AFTER * 2 ? "drawn" : null;
      setSel(null); send({ seat: otherSeat(me), b: nb, quiet, last: m, result }); return;
    }
    setSel(moves.some((x) => x.from === i) && sel !== i ? i : null);
  }
  const order = [...st.b.keys()]; if (me === 1) order.reverse();
  return (
    <>
      <Status text={text} sub={`you're ${me === 0 ? "pink" : "brown"} · ${DR.count(st.b, side)} vs ${DR.count(st.b, (-side) as 1 | -1)}`} />
      <div className="dr-board" role="grid" aria-label="Draughts board">
        {order.map((i) => {
          const v = st.b[i], dark = (Math.floor(i / DR.N) + (i % DR.N)) % 2 === 1;
          return (
            <button key={i} className={`dr-sq ${dark ? "dark" : ""} ${sel === i ? "sel" : ""} ${targets.includes(i) ? "target" : ""} ${lastSq.includes(i) ? "last" : ""} ${moves.some((m) => m.from === i) ? "movable" : ""}`} disabled={!dark} onClick={() => tap(i)}
              aria-label={`Square ${i + 1}: ${v * side > 0 ? "your " : v ? "their " : ""}${Math.abs(v) === 2 ? "king" : v ? "piece" : targets.includes(i) ? "move here" : "empty"}`}>
              {v !== 0 && <i className={`dr-piece ${v > 0 ? "you" : "them"}`}>{Math.abs(v) === 2 ? "👑" : ""}</i>}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ----- Connect Four: host is red (1) and drops first -----
export type FourState = { seat: Seat; b: C4.Board; last: number | null };
export const freshFour = (): FourState => ({ seat: 0, b: C4.empty(), last: null });
export function LiveFour({ st, me, joined, send }: Props<FourState>) {
  const who: 1 | 2 = me === 0 ? 1 : 2, win = C4.winner(st.b), full = C4.isFull(st.b);
  const mine = st.seat === me && !win && !full && joined;
  const text = win ? (win.who === who ? "Four in a row: you win! 🎉" : "Your friend got four in a row") : full ? "A draw" : !joined ? "Waiting for your friend to join…" : mine ? "Your drop" : "Their move…";
  function drop(c: number) {
    if (!mine) return;
    const nb = C4.drop(st.b, c, who);
    if (nb) send({ seat: otherSeat(me), b: nb, last: c });
  }
  const cells = new Set(win?.cells ?? []);
  return (
    <>
      <Status text={text} sub={`you're ${who === 1 ? "🔴 red" : "🟡 yellow"}`} />
      <div className="c4-wrap">
        <div className="c4-cols" style={{ gridTemplateColumns: `repeat(${C4.COLS}, 1fr)` }}>
          {[...Array(C4.COLS).keys()].map((c) => <button key={c} className="c4-vote" disabled={!mine || !C4.openCols(st.b).includes(c)} onClick={() => drop(c)} aria-label={`Drop in column ${c + 1}`}><span aria-hidden="true">▼</span></button>)}
        </div>
        <div className="c4-board" style={{ gridTemplateColumns: `repeat(${C4.COLS}, 1fr)` }} role="img" aria-label="Connect Four board">
          {st.b.map((v, i) => <span key={i} className={`c4-hole ${v === 1 ? "red" : v === 2 ? "yellow" : ""} ${cells.has(i) ? "win" : ""}`} />)}
        </div>
      </div>
    </>
  );
}

// ----- Backgammon: host is pink (side 0), guest brown (side 1). You roll and move on your own device, then send the turn. -----
export type BgState = { seat: Seat; s: BG.State; last: { dice: [number, number]; steps: BG.Step[] } | null };
export const freshBg = (): BgState => ({ seat: 0, s: BG.newGame(), last: null });
const FACE = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const TOP = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24], BOTTOM = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const sameStep = (a: BG.Step, b: BG.Step) => a.from === b.from && a.to === b.to && a.die === b.die;
export function LiveBackgammon({ st, me, joined, send }: Props<BgState>) {
  const [dice, setDice] = useState<[number, number] | null>(null);
  const [done, setDone] = useState<BG.Step[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const w = BG.winner(st.s), mine = st.seat === me && w === null && joined;
  const s = mine ? done.reduce((x, step) => BG.applyStep(x, me, step), st.s) : st.s;
  const options = dice && mine ? BG.plays(st.s, dice, false).filter((p) => done.every((x, k) => p[k] && sameStep(p[k], x))) : [];
  const next = options.map((p) => p[done.length]).filter(Boolean);
  const turnOver = !!dice && (options.length === 0 || options.every((p) => p.length === done.length));
  const targets = new Set(sel === null ? [] : next.filter((x) => x.from === sel).map((x) => x.to)), movable = new Set(next.map((x) => x.from));
  function tapPoint(i: number) {
    if (!mine || !dice) return;
    if (sel !== null) { const step = next.find((x) => x.from === sel && x.to === i); if (step) { setDone([...done, step]); setSel(null); return; } }
    setSel(movable.has(i) && sel !== i ? i : null);
  }
  function endTurn() { send({ seat: otherSeat(me), s: BG.finish(s), last: { dice: dice!, steps: done } }); setDice(null); setDone([]); setSel(null); }
  const text = w !== null ? (w === me ? "You win! 🎲🎉" : "Your friend wins") : !joined ? "Waiting for your friend to join…" : !mine ? "Their turn…" : !dice ? "Roll the dice" : turnOver ? "That's the roll used: end your turn" : sel !== null ? "Now pick where it goes" : "Pick a checker to move";
  const Point = ({ i, top }: { i: number; top: boolean }) => {
    const v = s.pts[i], n = Math.abs(v);
    return (
      <button className={`bg-pt ${top ? "top" : "bottom"} ${i % 2 ? "odd" : "even"} ${targets.has(i) ? "target" : ""} ${sel === i ? "sel" : ""} ${movable.has(i) && sel === null ? "can" : ""}`} onClick={() => tapPoint(i)}
        aria-label={`Point ${i}: ${n ? `${n} ${(v > 0) === (me === 0) ? "of yours" : "of theirs"}` : "empty"}${targets.has(i) ? ", move here" : ""}`}>
        <span className="bg-stack">{[...Array(Math.min(n, 5)).keys()].map((k) => <i key={k} className={`bg-ck ${v > 0 ? "you" : "them"}`}>{k === 4 && n > 5 ? n : ""}</i>)}</span>
        <small className="bg-num" aria-hidden="true">{i}</small>
      </button>
    );
  };
  const faces = dice ? (dice[0] === dice[1] ? [dice[0], dice[0], dice[0], dice[0]] : [...dice]) : [];
  const myOff = me === 0 ? 0 : 25;
  return (
    <>
      <Status text={text} sub={st.last && !dice ? `last roll ${FACE[st.last.dice[0]]} ${FACE[st.last.dice[1]]}` : `you're ${me === 0 ? "pink, home bottom right" : "brown, home top right"}`} />
      <div className="bg-board">
        <div className="bg-row">{TOP.slice(0, 6).map((i) => <Point key={i} i={i} top />)}<span className="bg-bar" aria-hidden="true" />{TOP.slice(6).map((i) => <Point key={i} i={i} top />)}</div>
        <div className="bg-mid">
          <button className={`bg-barbox ${movable.has(25) ? "can" : ""}`} onClick={() => me === 0 && tapPoint(25)} aria-label={`Pink bar: ${s.bar[0]}`}>{s.bar[0] ? <><i className="bg-ck you" /> ×{s.bar[0]}</> : null}</button>
          <span className="bg-dice">{faces.map((f, k) => <b key={k}>{FACE[f]}</b>)}</span>
          <button className={`bg-barbox them ${movable.has(0) ? "can" : ""}`} onClick={() => me === 1 && tapPoint(0)} aria-label={`Brown bar: ${s.bar[1]}`}>{s.bar[1] ? <><i className="bg-ck them" /> ×{s.bar[1]}</> : null}</button>
        </div>
        <div className="bg-row">{BOTTOM.slice(0, 6).map((i) => <Point key={i} i={i} top={false} />)}<span className="bg-bar" aria-hidden="true" />{BOTTOM.slice(6).map((i) => <Point key={i} i={i} top={false} />)}</div>
        <button className={`bg-off ${me === 1 ? "them" : ""} ${targets.has(myOff) ? "target" : ""}`} onClick={() => tapPoint(myOff)} aria-label={`Bear off here. ${s.off[me]} off so far.`}>{me === 0 ? `Off ↘ ${s.off[0]}` : `↗ Off ${s.off[1]}`}</button>
      </div>
      <div className="row" style={{ justifyContent: "center", gap: "0.5rem", marginTop: "0.6rem" }}>
        {mine && !dice && <button className="btn btn-pink" onClick={() => { setDice(BG.roll()); setDone([]); }}>🎲 Roll</button>}
        {mine && dice && <button className="btn btn-ghost btn-sm" onClick={() => { setDone([]); setSel(null); }} disabled={!done.length}>↩ Undo</button>}
        {mine && dice && <button className="btn btn-pink btn-sm" onClick={endTurn} disabled={!turnOver}>End turn</button>}
      </div>
      <p className="tiny muted center">Pink: {BG.pips(s, 0)} to go, {s.off[0]} off · Brown: {BG.pips(s, 1)} to go, {s.off[1]} off</p>
    </>
  );
}
