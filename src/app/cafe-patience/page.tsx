"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { RANK, SUITS, autoMove, canFinish, drawCards, finishStep, isWon, newGame, pinkSuit, type Card, type From, type Game } from "@/lib/patience";

const STATS = "mm-patience";
type Stats = { played: number; won: number; streak: number; best: number | null };

function Face({ c }: { c: Card }) {
  if (!c.up) return <span className="pc-card down" aria-label="Face-down card" />;
  return (
    <span className={`pc-card ${pinkSuit(c.suit) ? "pink" : "brown"}`}>
      <span className="pc-corner">{RANK[c.rank]}<i>{SUITS[c.suit]}</i></span>
      <span className="pc-mid" aria-hidden="true">{SUITS[c.suit]}</span>
    </span>
  );
}
const cardName = (c: Card) => `${RANK[c.rank] === "A" ? "Ace" : RANK[c.rank]} of ${SUITS[c.suit]}`;

export default function CafePatience() {
  const { toast } = useStore();
  const [draw, setDraw] = useState<1 | 3>(1);
  const [g, setG] = useState<Game | null>(null);
  const [undo, setUndo] = useState<Game[]>([]);
  const [stats, setStats] = useState<Stats>({ played: 0, won: 0, streak: 0, best: null });
  const [counted, setCounted] = useState(false);
  useEffect(() => {
    let d: 1 | 3 = 1;
    try { const s = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (s) { setStats({ played: s.played ?? 0, won: s.won ?? 0, streak: s.streak ?? 0, best: s.best ?? null }); d = s.draw === 3 ? 3 : 1; } } catch {}
    setDraw(d); setG(newGame(Math.random, d));
  }, []);
  function saveStats(s: Stats, d = draw) { setStats(s); try { localStorage.setItem(STATS, JSON.stringify({ ...s, draw: d })); } catch {} }
  function apply(next: Game | null) {
    if (!g || !next) return false;
    setUndo([...undo.slice(-200), g]); setG(next);
    // A game counts as played from your first move
    if (!counted) { setCounted(true); saveStats({ ...stats, played: stats.played + 1 }); }
    if (isWon(next)) {
      const s = { ...stats, played: stats.played + (counted ? 0 : 1), won: stats.won + 1, streak: stats.streak + 1, best: stats.best === null ? next.moves : Math.min(stats.best, next.moves) };
      saveStats(s); toast("You won! Every card's home 🎉");
    }
    return true;
  }
  function deal(d = draw) {
    // Leaving a game you'd started breaks your winning streak
    if (g && counted && !isWon(g)) saveStats({ ...stats, streak: 0 }, d);
    setG(newGame(Math.random, d)); setUndo([]); setCounted(false);
  }
  function tap(from: From) {
    if (!g) return;
    if (!apply(autoMove(g, from))) toast("No move for that card right now.");
  }
  // Finish off automatically, one card at a time so you can watch them go
  const [finishing, setFinishing] = useState(false);
  useEffect(() => {
    if (!finishing || !g) return;
    const next = finishStep(g);
    if (!next) { setFinishing(false); return; }
    const id = setTimeout(() => { apply(next); }, 70);
    return () => clearTimeout(id);
  });
  if (!g) return <div className="page"><p className="muted">Shuffling…</p></div>;
  const won = isWon(g);
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">a card game</p>
      <h1 className="h2">Café <em>patience</em></h1>
      <p className="small muted">Classic solitaire. Build each suit from ace to king on the four spaces at the top. In the columns, stack down in alternating colours (brown ☕🍫 on pink 🍓🌸). Only kings go in an empty column. Tap a card to move it.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {([1, 3] as const).map((d) => <button key={d} className={`chip ${draw === d ? "on" : ""}`} aria-pressed={draw === d} onClick={() => { setDraw(d); deal(d); }}>Draw {d}</button>)}
        <button className="btn btn-ghost btn-sm" onClick={() => { setG(undo[undo.length - 1]); setUndo(undo.slice(0, -1)); }} disabled={!undo.length || finishing}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => deal()}>New game</button>
        <span className="memory-stats"><span>Moves <b>{g.moves}</b></span></span>
      </div>

      <div className="pc-table">
        <div className="pc-top">
          <button className="pc-slot" onClick={() => apply(drawCards(g))} aria-label={g.stock.length ? `Draw from the pile, ${g.stock.length} left` : "Turn the pile back over"} disabled={!g.stock.length && !g.waste.length}>
            {g.stock.length ? <span className="pc-card down" /> : <span className="pc-empty">↻</span>}
          </button>
          <div className={`pc-slot pc-waste ${g.draw === 3 ? "fan" : ""}`}>
            {g.waste.slice(g.draw === 3 ? -3 : -1).map((c, i, a) => i === a.length - 1
              ? <button key={i} className="pc-btn" onClick={() => tap({ kind: "waste" })} aria-label={cardName(c)}><Face c={c} /></button>
              : <span key={i} className="pc-under"><Face c={c} /></span>)}
          </div>
          <span className="pc-gap" />
          {g.found.map((f, i) => (
            <div key={i} className="pc-slot">
              {f.length ? <button className="pc-btn" onClick={() => tap({ kind: "found", i })} aria-label={cardName(f[f.length - 1])}><Face c={f[f.length - 1]} /></button> : <span className="pc-empty">{SUITS[i]}</span>}
            </div>
          ))}
        </div>
        <div className="pc-piles">
          {g.piles.map((p, i) => (
            <div key={i} className="pc-pile" style={{ ["--n" as string]: p.length }}>
              {!p.length && <span className="pc-empty">K</span>}
              {p.map((c, k) => (
                <button key={k} className="pc-btn pc-in-pile" style={{ ["--k" as string]: k, ["--down" as string]: p.slice(0, k).filter((x) => !x.up).length }} disabled={!c.up}
                  onClick={() => tap({ kind: "pile", i, at: k })} aria-label={c.up ? cardName(c) : "Face-down card"}><Face c={c} /></button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {canFinish(g) && !finishing && <p className="center"><button className="btn btn-pink btn-sm" onClick={() => setFinishing(true)}>Send them all home ✨</button></p>}
      {won && (
        <section className="card memory-done" aria-live="polite">
          <b>You won in {g.moves} moves 🎉</b>
          <button className="btn btn-pink btn-sm" onClick={() => deal()}>Deal again</button>
        </section>
      )}
      <p className="small muted" style={{ marginTop: "1rem" }}>
        Played {stats.played} · won {stats.won}{stats.played ? ` (${Math.round((stats.won / stats.played) * 100)}%)` : ""}{stats.streak > 1 ? ` · ${stats.streak} wins in a row 🔥` : ""}{stats.best !== null ? ` · fewest moves ${stats.best}` : ""}
      </p>
      <p className="tiny muted">Not every deal can be won, even with perfect play. Your record is kept on this device.</p>
    </div>
  );
}
