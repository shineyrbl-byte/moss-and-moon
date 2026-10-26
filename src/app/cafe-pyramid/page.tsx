"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { RANK, SUITS, pinkSuit } from "@/lib/patience";
import { PASSES, deal, draw, firstOf, free, isStuck, isWon, take, type Card, type Spot, type State } from "@/lib/pyramid";
import { addFlag } from "@/lib/trophyFlags";

const STATS = "mm-pyramid";
function Face({ c }: { c: Card }) {
  return (
    <span className={`pc-card ${pinkSuit(c.suit) ? "pink" : "brown"}`}>
      <span className="pc-corner">{RANK[c.rank]}<i>{SUITS[c.suit]}</i></span>
      <span className="pc-mid" aria-hidden="true">{SUITS[c.suit]}</span>
    </span>
  );
}
const name = (c: Card) => `${RANK[c.rank]} of ${SUITS[c.suit]}`;

export default function CafePyramid() {
  const { toast } = useStore();
  const [s, setS] = useState<State | null>(null);
  const [undo, setUndo] = useState<State[]>([]);
  const [sel, setSel] = useState<Spot | null>(null);
  const [stats, setStats] = useState({ played: 0, won: 0 });
  const [counted, setCounted] = useState(false);
  useEffect(() => {
    try { setStats({ played: 0, won: 0, ...JSON.parse(localStorage.getItem(STATS) ?? "{}") }); } catch {}
    setS(deal(Math.random));
  }, []);
  function save(n: { played: number; won: number }) { setStats(n); try { localStorage.setItem(STATS, JSON.stringify(n)); } catch {} }
  function apply(next: State | null) {
    if (!s || !next) return false;
    setUndo([...undo.slice(-200), s]); setS(next); setSel(null);
    let st = stats;
    if (!counted) { setCounted(true); st = { ...st, played: st.played + 1 }; }
    if (isWon(next)) { st = { ...st, won: st.won + 1 }; addFlag("pyramid-win"); toast("The pyramid's gone! 🔺🎉"); }
    else if (isStuck(next)) toast("No moves left. Undo, or deal again.");
    if (st !== stats) save(st);
    return true;
  }
  function tap(x: Spot) {
    if (!s) return;
    // A king goes straight away; otherwise pick two that make 13
    if (apply(take(s, x))) return;
    if (!sel) { setSel(x); return; }
    if (sel.kind === x.kind && (x.kind === "waste" || (sel as { i: number }).i === (x as { i: number }).i)) { setSel(null); return; }
    if (!apply(take(s, sel, x))) { toast("Those don't make 13."); setSel(x); }
  }
  if (!s) return <div className="page"><p className="muted">Stacking the pyramid…</p></div>;
  const isSel = (x: Spot) => !!sel && sel.kind === x.kind && (x.kind === "waste" || (sel as { i: number }).i === (x as { i: number }).i);
  const top = s.waste[s.waste.length - 1];
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">a card game</p>
      <h1 className="h2">Café <em>pyramid</em></h1>
      <p className="small muted">Clear the pyramid by taking away pairs of cards that add up to 13: ace 1, jack 11, queen 12, and a king on its own. You can only take a card once nothing is covering it. Turn over the pile for more cards: you can go through it {PASSES} times.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => { const p = undo[undo.length - 1]; if (p) { setS(p); setUndo(undo.slice(0, -1)); setSel(null); } }} disabled={!undo.length}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setS(deal(Math.random)); setUndo([]); setSel(null); setCounted(false); }}>New game</button>
        <span className="memory-stats"><span>Left <b>{s.pyr.filter(Boolean).length}</b>/28</span><span>Pass <b>{s.passes}</b>/{PASSES}</span></span>
      </div>
      <div className="pc-table py-table">
        <div className="py-pyr">
          {[...Array(7).keys()].map((r) => (
            <div key={r} className="py-row">
              {[...Array(r + 1).keys()].map((k) => {
                const i = firstOf(r) + k, c = s.pyr[i];
                if (!c) return <span key={k} className="pc-slot py-gap" />;
                const open = free(s, i), x: Spot = { kind: "pyr", i };
                return <button key={k} className={`pc-btn py-card ${open ? "open" : ""} ${isSel(x) ? "fc-sel" : ""}`} onClick={() => open && tap(x)} aria-disabled={!open} aria-label={`${name(c)}${open ? "" : ", covered"}`}><Face c={c} /></button>;
              })}
            </div>
          ))}
        </div>
        <div className="py-pile">
          <button className="pc-slot" onClick={() => { if (!apply(draw(s))) toast("That's all the passes through the pile."); }} aria-label={s.stock.length ? `Turn over a card, ${s.stock.length} left` : "Start the pile again"}>
            {s.stock.length ? <span className="pc-card down" /> : <span className="pc-empty">{s.passes < PASSES ? "↻" : "·"}</span>}
          </button>
          <div className="pc-slot">{top ? <button className={`pc-btn ${isSel({ kind: "waste" }) ? "fc-sel" : ""}`} onClick={() => tap({ kind: "waste" })} aria-label={name(top)}><Face c={top} /></button> : <span className="pc-empty"> </span>}</div>
        </div>
      </div>
      {isWon(s) && <section className="card memory-done" aria-live="polite"><b>Pyramid cleared in {s.moves} moves 🎉</b><button className="btn btn-pink btn-sm" onClick={() => { setS(deal(Math.random)); setUndo([]); setCounted(false); }}>Deal again</button></section>}
      <p className="small muted" style={{ marginTop: "1rem" }}>Won {stats.won} of {stats.played} on this device.</p>
      <p className="tiny muted">Pyramid is mostly luck of the deal: many can&apos;t be cleared, so don&apos;t worry about a loss.</p>
    </div>
  );
}
