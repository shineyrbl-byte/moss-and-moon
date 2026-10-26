"use client";
import "./page.css";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { RANK, SUITS, pinkSuit } from "@/lib/patience";
import { bestTarget, deal, dealRow, isRun, isWon, move, type Card, type State, type Suits } from "@/lib/spider";
import { addFlag } from "@/lib/trophyFlags";

const STATS = "mm-spider";
type Rec = { played: number; won: number };
function Face({ c }: { c: Card }) {
  if (!c.up) return <span className="pc-card down" aria-label="Face-down card" />;
  return (
    <span className={`pc-card ${pinkSuit(c.suit) ? "pink" : "brown"}`}>
      <span className="pc-corner">{RANK[c.rank]}<i>{SUITS[c.suit]}</i></span>
      <span className="pc-mid" aria-hidden="true">{SUITS[c.suit]}</span>
    </span>
  );
}

export default function CafeSpider() {
  const { toast } = useStore();
  const [suits, setSuits] = useState<Suits>(1);
  const [s, setS] = useState<State | null>(null);
  const [undo, setUndo] = useState<State[]>([]);
  const [sel, setSel] = useState<{ col: number; at: number } | null>(null);
  const [stats, setStats] = useState<Record<Suits, Rec>>({ 1: { played: 0, won: 0 }, 2: { played: 0, won: 0 } });
  const [counted, setCounted] = useState(false);
  useEffect(() => {
    let n: Suits = 1;
    try { const v = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (v) { setStats({ 1: { played: 0, won: 0 }, 2: { played: 0, won: 0 }, ...v.stats }); n = v.suits === 2 ? 2 : 1; } } catch {}
    setSuits(n); setS(deal(Math.random, n));
  }, []);
  function saveStats(next: Record<Suits, Rec>, n = suits) { setStats(next); try { localStorage.setItem(STATS, JSON.stringify({ stats: next, suits: n })); } catch {} }
  function apply(next: State | null) {
    if (!s || !next) return false;
    setUndo([...undo.slice(-200), s]); setS(next); setSel(null);
    let st = stats;
    if (!counted) { setCounted(true); st = { ...st, [suits]: { ...st[suits], played: st[suits].played + 1 } }; }
    if (next.done > s.done) toast(next.done === 8 ? "Every run cleared! You win 🕸🎉" : `A full run cleared: ${next.done} of 8 ✨`);
    if (isWon(next)) { st = { ...st, [suits]: { ...st[suits], won: st[suits].won + 1 } }; addFlag(suits === 2 ? "spider-two" : "spider-win"); }
    if (st !== stats) saveStats(st);
    return true;
  }
  function newDeal(n = suits) { setSuits(n); setS(deal(Math.random, n)); setUndo([]); setSel(null); setCounted(false); if (n !== suits) saveStats(stats, n); }
  function tap(col: number, at: number) {
    if (!s) return;
    // Tap a run to pick it up, then a column to put it down; tap it again to send it to the best place
    if (sel && sel.col === col && sel.at === at) { const t = bestTarget(s, col, at); if (t === null || !apply(move(s, col, at, t))) { toast("Nowhere for that run to go."); setSel(null); } return; }
    if (sel && sel.col !== col) { if (apply(move(s, sel.col, sel.at, col))) return; }
    if (isRun(s.cols[col], at)) setSel({ col, at });
    else { setSel(null); if (s.cols[col][at]?.up) toast("Only a run in one suit moves together."); }
  }
  function tapEmpty(col: number) { if (s && sel) { if (!apply(move(s, sel.col, sel.at, col))) toast("That run can't go there."); } }
  if (!s) return <div className="page"><p className="muted">Shuffling two decks…</p></div>;
  const rec = stats[suits];
  const inSel = (col: number, k: number) => !!sel && sel.col === col && k >= sel.at;
  return (
    <div className="page" style={{ maxWidth: "46rem" }}>
      <p className="eyebrow">a card game</p>
      <h1 className="h2">Café <em>spider</em></h1>
      <p className="small muted">Spider solitaire with two decks. Build down by one in any suit, but only a run all in one suit can move together. A full run from king down to ace in one suit is cleared away: clear all eight to win. Stuck? Deal a fresh card onto every column (every column needs a card first).</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {([1, 2] as Suits[]).map((n) => <button key={n} className={`chip ${suits === n ? "on" : ""}`} aria-pressed={suits === n} onClick={() => newDeal(n)}>{n === 1 ? "One suit" : "Two suits"}</button>)}
        <button className="btn btn-ghost btn-sm" onClick={() => { const p = undo[undo.length - 1]; if (p) { setS(p); setUndo(undo.slice(0, -1)); setSel(null); } }} disabled={!undo.length}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => newDeal()}>New game</button>
        <button className="btn btn-pink btn-sm" onClick={() => { if (!apply(dealRow(s))) toast(s.stock.length ? "Every column needs at least one card before you deal." : "No cards left to deal."); }} disabled={!s.stock.length}>Deal a row ({s.stock.length / 10} left)</button>
        <span className="memory-stats"><span>Runs <b>{s.done}</b>/8</span><span>Moves <b>{s.moves}</b></span></span>
      </div>
      <div className="pc-table sp-table">
        <div className="sp-cols">
          {s.cols.map((col, ci) => (
            <div key={ci} className="pc-pile sp-pile" style={{ ["--n" as string]: col.length }}>
              {!col.length && <button className="pc-btn" onClick={() => tapEmpty(ci)} aria-label={`Column ${ci + 1}, empty`}><span className="pc-empty"> </span></button>}
              {col.map((c, k) => (
                <button key={k} className={`pc-btn pc-in-pile ${inSel(ci, k) ? "fc-sel" : ""}`} style={{ ["--k" as string]: k, ["--down" as string]: col.slice(0, k).filter((x) => !x.up).length }}
                  onClick={() => tap(ci, k)} disabled={!c.up} aria-label={c.up ? `Column ${ci + 1}: ${RANK[c.rank]} of ${SUITS[c.suit]}` : "Face-down card"}>
                  <Face c={c} />
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      {isWon(s) && <section className="card memory-done" aria-live="polite"><b>Every run cleared in {s.moves} moves 🎉</b><button className="btn btn-pink btn-sm" onClick={() => newDeal()}>Deal again</button></section>}
      <p className="small muted" style={{ marginTop: "1rem" }}>{suits === 1 ? "One suit" : "Two suits"}: won {rec.won} of {rec.played}</p>
      <p className="tiny muted">One suit is the gentle version; two suits takes some planning. Your record is kept on this device.</p>
    </div>
  );
}
