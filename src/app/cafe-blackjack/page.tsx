"use client";
import "../cafe-poker/page.css";
import { useEffect, useState } from "react";
import { BETS, START, deal, double, hit, newTable, stand, total, type Card, type State } from "@/lib/blackjack";
import { addFlag } from "@/lib/trophyFlags";

const SAVE = "mm-blackjack";
const RANK = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"], SUITS = ["♠", "♥", "♦", "♣"];
const PCard = ({ c, down }: { c: Card; down?: boolean }) => down ? <span className="pk-card down" aria-label="face-down card" /> : <span className={`pk-card ${c.s === 1 || c.s === 2 ? "red" : ""}`} aria-label={`${RANK[c.r]} of ${["spades", "hearts", "diamonds", "clubs"][c.s]}`}><b>{RANK[c.r]}</b>{SUITS[c.s]}</span>;

export default function CafeBlackjack() {
  const [s, setS] = useState<State | null>(null);
  const [bet, setBet] = useState(25);
  const [best, setBest] = useState(START);
  useEffect(() => {
    let chips = START, b = START;
    try { const v = JSON.parse(localStorage.getItem(SAVE) ?? "null"); if (v) { chips = v.chips > 0 ? v.chips : START; b = v.best ?? START; } } catch {}
    setS({ ...newTable(Math.random), chips }); setBest(b);
  }, []);
  useEffect(() => {
    if (!s || s.phase !== "done") return;
    const b = Math.max(best, s.chips);
    setBest(b);
    if (s.chips >= 2000) addFlag("blackjack-double");
    try { localStorage.setItem(SAVE, JSON.stringify({ chips: s.chips, best: b })); } catch {}
  }, [s?.phase]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return <div className="page"><p className="muted">Shuffling the shoe…</p></div>;
  const playing = s.phase === "play", you = total(s.you), dealer = total(s.dealer);
  const broke = s.phase !== "play" && s.chips < BETS[0];
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">a card game</p>
      <h1 className="h2">Café <em>blackjack</em></h1>
      <p className="small muted">Played for café chips, never money. Get closer to 21 than the dealer without going over. Picture cards are 10 and aces 1 or 11. Blackjack pays 3 to 2, the dealer draws to 16 and stands on 17, and you can double down on your first two cards.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>🪙 <b>{s.chips}</b></span><span>Bet <b>{s.bet || bet}</b></span><span>Best <b>{best}</b></span></div>
      <div className="pk-table">
        <div className="pk-seat"><div className="pk-name">Dealer{s.dealer.length ? ` · ${playing ? "?" : dealer.t}` : ""}</div><div className="pk-cards">{s.dealer.map((c, k) => <PCard key={k} c={c} down={playing && k === 1} />)}</div></div>
        <div className="pk-seat on"><div className="pk-name">You{s.you.length ? ` · ${you.t}${you.soft && you.t < 21 ? " (soft)" : ""}` : ""}</div><div className="pk-cards">{s.you.map((c, k) => <PCard key={k} c={c} />)}</div></div>
      </div>
      <p className="center small" aria-live="polite" style={{ margin: "0.6rem 0" }}><b>{s.result || (playing ? "Hit or stand?" : "Place your bet")}</b>{s.phase === "done" && s.won !== 0 ? <span className="muted"> · {s.won > 0 ? `+${s.won}` : s.won}</span> : null}</p>
      {playing ? (
        <div className="pk-actions">
          <button className="btn btn-pink btn-sm" onClick={() => setS(hit(s, Math.random))}>Hit</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setS(stand(s, Math.random))}>Stand</button>
          {s.you.length === 2 && s.chips >= s.bet && <button className="btn btn-ghost btn-sm" onClick={() => setS(double(s, Math.random))}>Double ({s.bet * 2})</button>}
        </div>
      ) : broke ? (
        <p className="center"><button className="btn btn-pink btn-sm" onClick={() => setS({ ...newTable(Math.random) })}>Out of chips: start again with {START}</button></p>
      ) : (
        <div className="pk-actions">
          {BETS.map((b) => <button key={b} className={`chip ${bet === b ? "on" : ""}`} onClick={() => setBet(b)} disabled={b > s.chips}>{b}</button>)}
          <button className="btn btn-pink btn-sm" onClick={() => setS(deal(s, Math.min(bet, s.chips), Math.random))}>Deal</button>
        </div>
      )}
      <p className="tiny muted" style={{ marginTop: "1rem" }}>Your chips are kept on this device. Six decks, shuffled when they run low.</p>
    </div>
  );
}
