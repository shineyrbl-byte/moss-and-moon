"use client";
import "../cafe-poker/page.css";
import "./page.css";
import { useEffect, useState } from "react";
import PeakCard, { cardName } from "@/components/PeakCard";
import { ROWS, isFree, newPeaks, peaksDraw, peaksLeft, peaksPlay, peaksStuck, rowStart, type Peaks } from "@/lib/peaks";
import { addFlag } from "@/lib/trophyFlags";

const STATS = "mm-tripeaks";
// Where each card sits: rows are offset like a pyramid, three peaks side by side
function spot(i: number): [number, number] {
  const row = rowStart.findLastIndex((s) => i >= s), k = i - rowStart[row];
  if (row === 3) return [3, k];
  if (row === 2) return [2, k + 0.5];
  if (row === 1) { const peak = Math.floor(k / 2); return [1, 1 + peak * 3 + (k % 2)]; }
  return [0, 1.5 + k * 3];
}

export default function TriPeaks() {
  const [p, setP] = useState<Peaks | null>(null);
  const [rec, setRec] = useState({ played: 0, won: 0, best: 0 });
  const [counted, setCounted] = useState(false);
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (v) setRec(v); } catch {} setP(newPeaks(Math.random)); }, []);
  const over = !!p && (peaksLeft(p) === 0 || peaksStuck(p));
  useEffect(() => {
    if (!p || !over || counted) return;
    setCounted(true);
    const won = peaksLeft(p) === 0, next = { played: rec.played + 1, won: rec.won + (won ? 1 : 0), best: Math.max(rec.best, p.score) };
    if (won) addFlag("tripeaks-clear");
    setRec(next); try { localStorage.setItem(STATS, JSON.stringify(next)); } catch {}
  }, [over]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!p) return <div className="page"><p className="muted">Dealing…</p></div>;
  const top = p.pile[p.pile.length - 1];
  return (
    <div className="page" style={{ maxWidth: "38rem" }}>
      <p className="eyebrow">a card game</p>
      <h1 className="h2">Tri<em>Peaks</em></h1>
      <p className="small muted">Clear the three peaks. A card is free once nothing overlaps it. Play a free card if it&apos;s one higher or one lower than the top of the pile (any suit); kings and aces join up. Runs of plays without turning a card score more and more.</p>
      <p className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>Score <b>{p.score}</b></span><span>Run <b>{p.streak}</b></span><span>Best <b>{rec.best}</b></span></p>
      <div className="tp-peaks" style={{ height: `${ROWS.length * 1.9 + 3}rem` }}>
        {p.cards.map((c, i) => {
          if (!c) return null;
          const [r, x] = spot(i), free = isFree(p, i), ok = free && !!peaksPlay(p, i);
          return (
            <button key={i} className={`tp-card ${ok ? "can" : ""}`} style={{ top: `${r * 1.9}rem`, left: `${((x + 0.5) / 10) * 100}%` }} disabled={!free} onClick={() => { const n = peaksPlay(p, i); if (n) setP(n); }} aria-label={free ? `${cardName(c)}${ok ? ", playable" : ""}` : "A covered card"}>
              <PeakCard c={c} down={!free} />
            </button>
          );
        })}
      </div>
      <div className="gs-bottom">
        <button className="tp-stock" onClick={() => { const n = peaksDraw(p); if (n) setP(n); }} disabled={!p.stock.length} aria-label={`Turn a card, ${p.stock.length} left`}>{p.stock.length ? <PeakCard down /> : <span className="pk-card" style={{ opacity: 0.3 }} />}<small className="tiny muted">{p.stock.length}</small></button>
        <span aria-label={`Pile: ${cardName(top)}`}><PeakCard c={top} /></span>
      </div>
      {over && <p className="center"><b>{peaksLeft(p) ? `No more moves: ${p.score} points, ${peaksLeft(p)} cards left.` : `All three peaks cleared! ${p.score} points 🏔️🎉`}</b><br /><button className="btn btn-pink btn-sm" style={{ marginTop: "0.5rem" }} onClick={() => { setP(newPeaks(Math.random)); setCounted(false); }}>Deal again</button></p>}
      <p className="small muted">Cleared {rec.won} of {rec.played} on this device.</p>
    </div>
  );
}
