"use client";
import "./page.css";
import { useEffect, useState } from "react";
import { BIG, NAMES, SMALL, START, act, bestOf, categoryOf, computerAction, newTable, pot, raiseRange, startHand, toCall, type Card, type Hand, type Level, type Seat } from "@/lib/poker";
import { addFlag } from "@/lib/trophyFlags";

const STATS = "mm-poker";
const RANK = ["", "", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"], SUITS = ["♠", "♥", "♦", "♣"];
function PCard({ c, down }: { c?: Card; down?: boolean }) {
  if (!c || down) return <span className="pk-card down" aria-hidden="true" />;
  return <span className={`pk-card ${c.s === 1 || c.s === 2 ? "red" : ""}`}><b>{RANK[c.r]}</b>{SUITS[c.s]}</span>;
}
const say = (c: Card) => `${RANK[c.r]}${SUITS[c.s]}`;

export default function CafePoker() {
  const [level, setLevel] = useState<Level>("easy");
  const [h, setH] = useState<Hand | null>(null);
  const [raiseTo, setRaiseTo] = useState(0);
  const [stats, setStats] = useState({ best: START, sessions: 0, wins: 0 });
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (v) { setStats({ best: START, sessions: 0, wins: 0, ...v.stats }); if (v.level === "hard") setLevel("hard"); } } catch {}
    setH(startHand(newTable(), Math.floor(Math.random() * 4), 1, Math.random));
  }, []);
  function save(next: typeof stats, lv = level) { setStats(next); try { localStorage.setItem(STATS, JSON.stringify({ stats: next, level: lv })); } catch {} }
  // Computers take their turn after a short pause
  useEffect(() => {
    if (!h || h.result || h.turn === 0) return;
    const id = setTimeout(() => setH(act(h, computerAction(h, level, Math.random))), 750);
    return () => clearTimeout(id);
  }, [h, level]);
  useEffect(() => { if (h && !h.result && h.turn === 0) setRaiseTo(raiseRange(h).min); }, [h?.turn, h?.street]); // eslint-disable-line react-hooks/exhaustive-deps
  // After each hand: biggest stack so far, and whether the session's over
  useEffect(() => {
    if (!h?.result) return;
    const mine = h.seats[0].chips;
    if (h.result.won[0] && h.seats.filter((s, i) => i !== 0 && !s.folded && !s.out).length >= 2) addFlag("poker-showdown");
    const others = h.seats.slice(1).every((s) => s.chips <= 0);
    if (others) { addFlag("poker-cleanup"); save({ ...stats, best: Math.max(stats.best, mine), sessions: stats.sessions + 1, wins: stats.wins + 1 }); }
    else if (mine > stats.best) save({ ...stats, best: mine });
  }, [h?.result]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!h) return <div className="page"><p className="muted">Shuffling…</p></div>;
  const me = h.seats[0], myTurn = !h.result && h.turn === 0;
  const owe = toCall(h), range = myTurn ? raiseRange(h) : { min: 0, max: 0 };
  const busted = me.chips <= 0 && !!h.result, won = !!h.result && h.seats.slice(1).every((s) => s.chips <= 0);
  function nextHand() {
    let dealer = (h!.dealer + 1) % 4;
    while (h!.seats[dealer].chips <= 0) dealer = (dealer + 1) % 4;
    setH(startHand(h!.seats, dealer, h!.handNo + 1, Math.random));
  }
  function newSession(lv = level) {
    if (!won && !busted && h!.handNo > 1) save({ ...stats, sessions: stats.sessions + 1 }, lv); else if (lv !== level) save(stats, lv);
    setLevel(lv); setH(startHand(newTable(), Math.floor(Math.random() * 4), 1, Math.random));
  }
  const showdown = !!h.result && h.street === "showdown" && h.seats.filter((s) => !s.folded && !s.out).length > 1;
  const mineNow = me.cards.length && h.board.length >= 3 && !me.folded ? categoryOf(bestOf([...me.cards, ...h.board])) : null;
  const seat = (s: Seat, i: number) => (
    <div key={i} className={`pk-seat ${h.turn === i && !h.result ? "on" : ""} ${s.folded ? "folded" : ""} ${s.out ? "out" : ""} ${h.result?.winners.includes(i) ? "won" : ""}`}>
      <div className="pk-name">{NAMES[i]}{h.dealer === i && <span className="pk-button" title="Dealer">D</span>}</div>
      <div className="pk-cards">{s.out ? <span className="small muted">out</span> : s.cards.map((c, k) => <PCard key={k} c={c} down={i !== 0 && !(showdown && !s.folded)} />)}</div>
      <div className="pk-chips">🪙 {s.chips}{s.bet ? <span className="pk-bet"> · in {s.bet}</span> : null}</div>
      <div className="pk-last small muted" aria-live="polite">{s.last}</div>
    </div>
  );
  return (
    <div className="page" style={{ maxWidth: "44rem" }}>
      <p className="eyebrow">a card game</p>
      <h1 className="h2">Café <em>poker</em></h1>
      <p className="small muted">Texas hold&apos;em for café chips, never money. Everyone starts with {START}, and the blinds are {SMALL} and {BIG}. Make the best five-card hand from your two cards and the five on the table, or bet like you have. Knock everyone else out to win the session.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {(["easy", "hard"] as const).map((lv) => <button key={lv} className={`chip ${level === lv ? "on" : ""}`} aria-pressed={level === lv} onClick={() => lv !== level && newSession(lv)}>{lv === "easy" ? "Easy table" : "Sharp table"}</button>)}
        <button className="btn btn-ghost btn-sm" onClick={() => newSession()}>New session</button>
      </div>
      <div className="pk-table">
        <div className="pk-others">{h.seats.slice(1).map((s, k) => seat(s, k + 1))}</div>
        <div className="pk-board" aria-label={`On the table: ${h.board.map(say).join(", ") || "nothing yet"}. Pot ${pot(h)}`}>
          <div className="pk-cards">{[0, 1, 2, 3, 4].map((k) => <PCard key={k} c={h.board[k]} down={!h.board[k]} />)}</div>
          <div className="pk-pot">Pot <b>{pot(h)}</b></div>
        </div>
        {seat(me, 0)}
      </div>
      <p className="center small" aria-live="polite" style={{ margin: "0.6rem 0" }}>
        <b>{h.result ? h.result.text : myTurn ? (owe ? `${owe} to call` : "Your move") : `${NAMES[h.turn]} is thinking…`}</b>
        {mineNow && !h.result && <span className="muted"> · you have {mineNow.toLowerCase()}</span>}
      </p>
      {myTurn && (
        <div className="pk-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => setH(act(h, { kind: "fold" }))}>Fold</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setH(act(h, { kind: owe ? "call" : "check" }))}>{owe ? (owe >= me.chips ? `All in (${me.chips})` : `Call ${owe}`) : "Check"}</button>
          {range.max > h.toMatch && range.max > owe && (
            <>
              <label className="pk-raise"><span className="sr-only">Raise to</span><input type="range" min={range.min} max={range.max} step={10} value={Math.min(range.max, Math.max(range.min, raiseTo))} onChange={(e) => setRaiseTo(Number(e.target.value))} /></label>
              <button className="btn btn-pink btn-sm" onClick={() => setH(act(h, { kind: "raise", to: raiseTo }))}>{raiseTo >= range.max ? `All in (${range.max})` : `${h.toMatch ? "Raise to" : "Bet"} ${Math.max(range.min, raiseTo)}`}</button>
            </>
          )}
        </div>
      )}
      {h.result && (
        <div className="row" style={{ justifyContent: "center", gap: "0.5rem" }}>
          {busted ? <><b className="small">You&apos;re out of chips.</b><button className="btn btn-pink btn-sm" onClick={() => newSession()}>Start a new session</button></>
            : won ? <><b className="small">You&apos;ve won every chip! 🎉</b><button className="btn btn-pink btn-sm" onClick={() => newSession()}>New session</button></>
            : <button className="btn btn-pink btn-sm" onClick={nextHand}>Next hand</button>}
        </div>
      )}
      <p className="small muted" style={{ marginTop: "1rem" }}>Biggest stack: {stats.best} · sessions won: {stats.wins} of {stats.sessions}</p>
      <p className="tiny muted">Hands, best first: straight flush, four of a kind, full house, flush, straight, three of a kind, two pair, pair, high card. The sharp table works out its chances more carefully and bluffs a bit more.</p>
    </div>
  );
}
