"use client";
import "../cafe-poker/page.css";
import "./page.css";
import { useEffect, useState } from "react";
import PeakCard, { cardName } from "@/components/PeakCard";
import { golfDraw, golfLeft, golfPlay, golfStuck, newGolf, type Golf } from "@/lib/peaks";
import { addFlag } from "@/lib/trophyFlags";

const STATS = "mm-golf-cards";

export default function GolfSolitaire() {
  const [g, setG] = useState<Golf | null>(null);
  const [rec, setRec] = useState({ played: 0, won: 0, best: 35 });
  const [counted, setCounted] = useState(false);
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (v) setRec(v); } catch {} setG(newGolf(Math.random)); }, []);
  const over = !!g && (golfLeft(g) === 0 || golfStuck(g));
  useEffect(() => {
    if (!g || !over || counted) return;
    setCounted(true);
    const left = golfLeft(g), next = { played: rec.played + 1, won: rec.won + (left ? 0 : 1), best: Math.min(rec.best, left) };
    if (!left) addFlag("golf-cards-clear");
    setRec(next); try { localStorage.setItem(STATS, JSON.stringify(next)); } catch {}
  }, [over]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!g) return <div className="page"><p className="muted">Dealing…</p></div>;
  const top = g.pile[g.pile.length - 1];
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">a card game</p>
      <h1 className="h2">Golf <em>solitaire</em></h1>
      <p className="small muted">Clear the seven columns. Tap the bottom card of a column to play it if it&apos;s one higher or one lower than the top of the pile (any suit). Stuck? Turn a card from the stock. Nothing goes on a king, and aces and kings don&apos;t join up. Fewest cards left is your score, like golf.</p>
      <p className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>Left <b>{golfLeft(g)}</b></span><span>Stock <b>{g.stock.length}</b></span><span>Best <b>{rec.best}</b></span></p>
      <div className="gs-cols">
        {g.cols.map((col, k) => (
          <div key={k} className="gs-col">
            {col.map((c, j) => {
              const last = j === col.length - 1, ok = last && !!golfPlay(g, k);
              return last ? <button key={j} className={`gs-card ${ok ? "can" : ""}`} onClick={() => { const n = golfPlay(g, k); if (n) setG(n); }} aria-label={`${cardName(c)}${ok ? ", playable" : ""}`}><PeakCard c={c} /></button> : <span key={j} className="gs-card"><PeakCard c={c} /></span>;
            })}
          </div>
        ))}
      </div>
      <div className="gs-bottom">
        <button className="gs-card" onClick={() => { const n = golfDraw(g); if (n) setG(n); }} disabled={!g.stock.length} aria-label={`Turn a card, ${g.stock.length} left`}>{g.stock.length ? <PeakCard down /> : <span className="pk-card" style={{ opacity: 0.3 }} />}</button>
        <span className="gs-card" role="img" aria-label={`Pile: ${cardName(top)}`}><PeakCard c={top} /></span>
      </div>
      {over && <p className="center"><b>{golfLeft(g) ? `No more moves: ${golfLeft(g)} left.` : "Every column cleared! ⛳🎉"}</b><br /><button className="btn btn-pink btn-sm" style={{ marginTop: "0.5rem" }} onClick={() => { setG(newGolf(Math.random)); setCounted(false); }}>Deal again</button></p>}
      <p className="small muted">Cleared {rec.won} of {rec.played} on this device.</p>
    </div>
  );
}
