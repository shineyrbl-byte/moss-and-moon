"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { BONUS, BONUS_AT, CATS, EXTRA_FIVE, ROLLS, bonusFor, fillRow, finished, isFive, roll, scoreFor, total, upperTotal, type Card, type Cat } from "@/lib/dice";
import { addFlag } from "@/lib/trophyFlags";

type Board = { top: { name: string; score: number }[]; mine: number | null; best: number | null };
type Game = { dice: number[]; held: boolean[]; left: number; card: Card; extras: number };
const GAME = "mm-dice-game", BEST = "mm-dice-best";
const fresh = (): Game => ({ dice: [0, 0, 0, 0, 0], held: [false, false, false, false, false], left: ROLLS, card: {}, extras: 0 });
// Which of the nine pip spots are filled for each face
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function Die({ v, held, rolling, onClick, disabled, n }: { v: number; held: boolean; rolling: boolean; onClick: () => void; disabled: boolean; n: number }) {
  return (
    <button className={`dc-die ${held ? "held" : ""} ${rolling && !held ? "rolling" : ""} ${v ? "" : "blank"}`} onClick={onClick} disabled={disabled} aria-pressed={held}
      aria-label={v ? `Die ${n}: ${v}${held ? ", held" : ""}` : `Die ${n}: not rolled yet`}>
      {[...Array(9).keys()].map((i) => <i key={i} className={v && PIPS[v].includes(i) ? "on" : ""} />)}
    </button>
  );
}

export default function CafeDice() {
  const { toast } = useStore();
  const [g, setG] = useState<Game>(fresh());
  const [rolling, setRolling] = useState(false);
  const [best, setBest] = useState(0);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(GAME) ?? "null");
      if (v?.dice?.length === 5) { setG(v.game ?? v); setSaved(!!v.saved); }
      setBest(Number(localStorage.getItem(BEST)) || 0); setName(localStorage.getItem("mm-game-name") ?? "");
    } catch {}
    setLoaded(true);
    fetch(`/api/arcade?game=dice&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  useEffect(() => { if (loaded) try { localStorage.setItem(GAME, JSON.stringify({ ...g, saved })); } catch {} }, [g, saved, loaded]);
  const over = finished(g.card);
  const rolled = g.left < ROLLS;
  const score = total(g.card, g.extras);

  function doRoll() {
    if (!g.left || over) return;
    const dice = roll(g.dice, rolled ? g.held : [false, false, false, false, false]);
    setRolling(true); setTimeout(() => setRolling(false), 380);
    setG({ ...g, dice, held: rolled ? g.held : [false, false, false, false, false], left: g.left - 1 });
    if (isFive(dice)) { addFlag("dice-five"); toast("Five of a kind! 🎲🎉"); }
  }
  function hold(i: number) {
    if (!rolled || !g.left || over) return;
    setG({ ...g, held: g.held.map((h, j) => (j === i ? !h : h)) });
  }
  function score1(cat: Cat) {
    if (!rolled) return;
    const r = fillRow(g.card, g.extras, cat, g.dice);
    if (!r) return;
    if (r.extras > g.extras) toast(`Another five of a kind: +${EXTRA_FIVE}! 🌟`);
    const next = { ...fresh(), card: r.card, extras: r.extras };
    setG(next);
    if (finished(r.card)) {
      const t = total(r.card, r.extras);
      if (t > best) { setBest(t); try { localStorage.setItem(BEST, String(t)); } catch {} toast(`New best: ${t}! 🎲`); }
    }
  }
  function newGame() { setG(fresh()); setSaved(false); }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/arcade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "dice", score, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  const turn = CATS.filter((c) => g.card[c.id] !== undefined).length + (over ? 0 : 1);
  const up = upperTotal(g.card);
  const row = (c: (typeof CATS)[number]) => {
    const v = g.card[c.id];
    return (
      <tr key={c.id} className={v !== undefined ? "filled" : ""}>
        <th scope="row"><b>{c.name}</b><span className="tiny muted">{c.how}</span></th>
        <td>{v !== undefined ? <b>{v}</b> : rolled && !over ? <button className={`dc-pick ${scoreFor(c.id, g.dice) ? "" : "zero"}`} onClick={() => score1(c.id)} aria-label={`Score ${scoreFor(c.id, g.dice)} for ${c.name}`}>{scoreFor(c.id, g.dice)}</button> : <span className="muted">–</span>}</td>
      </tr>
    );
  };
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">an arcade game</p>
      <h1 className="h2">Café <em>dice</em></h1>
      <p className="small muted">Thirteen turns, five dice. Each turn you can roll up to three times: tap a die between rolls to hold it. Then pick one row of the score card to fill, even if it scores nothing. Get {BONUS_AT} or more in the top half for a {BONUS}-point bonus.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}>
        <span>Turn <b>{Math.min(turn, 13)}</b>/13</span><span>Score <b>{score}</b></span><span>Best <b>{best}</b></span>
      </div>
      {!over ? (
        <section className="dc-table" aria-label="Dice">
          <div className="dc-dice">{g.dice.map((v, i) => <Die key={i} n={i + 1} v={v} held={g.held[i]} rolling={rolling} onClick={() => hold(i)} disabled={!rolled || !g.left} />)}</div>
          <p className="center" style={{ margin: "0.6rem 0 0" }}>
            <button className="btn btn-pink" onClick={doRoll} disabled={!g.left}>{!rolled ? "🎲 Roll" : g.left ? `🎲 Roll again (${g.left} left)` : "Pick a row below"}</button>
          </p>
          <p className="tiny muted center" style={{ margin: "0.4rem 0 0" }} aria-live="polite">{!rolled ? "Roll to start the turn." : g.left ? "Tap dice to hold them, roll again, or pick a row." : "No rolls left: pick a row to score."}</p>
        </section>
      ) : (
        <section className="card memory-done" aria-live="polite">
          <b>Game over: {score} points 🎉</b>
          {!saved && score > 0 ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save score</button>
            </div>
          ) : saved && <p className="small" style={{ margin: 0 }}>Saved ✓</p>}
          <button className="btn btn-ghost btn-sm" onClick={newGame}>New game</button>
        </section>
      )}
      <table className="dc-card">
        <caption className="sr-only">Score card</caption>
        <tbody>
          {CATS.filter((c) => c.upper).map(row)}
          <tr className="dc-sub"><th scope="row">Top half <span className="tiny muted">{up}/{BONUS_AT} for the bonus</span></th><td>{bonusFor(g.card) ? <b>+{BONUS}</b> : <span className="muted">{up}</span>}</td></tr>
          {CATS.filter((c) => !c.upper).map(row)}
          {g.extras > 0 && <tr className="dc-sub"><th scope="row">Extra fives of a kind</th><td><b>+{g.extras * EXTRA_FIVE}</b></td></tr>}
          <tr className="dc-total"><th scope="row">Total</th><td><b>{score}</b></td></tr>
        </tbody>
      </table>
      {!over && rolled && <p className="tiny muted">Each number on the card is what that row would score with these dice.</p>}
      {!over && turn > 1 && <p className="tiny"><button className="link-btn" onClick={newGame}>Start a new game</button></p>}
      {board && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">This week&apos;s best</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{t.score}</b></li>)}</ol> : <p className="small muted">No scores yet this week. Set the first one.</p>}
          <p className="tiny muted">The board starts fresh every Monday. A second five of a kind, after scoring 50 for the first, is worth {EXTRA_FIVE} more.</p>
        </section>
      )}
    </div>
  );
}
