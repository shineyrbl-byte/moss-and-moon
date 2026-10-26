"use client";
import "./page.css";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import ArchiveNote from "@/components/ArchiveNote";
import ShareResult from "@/components/ShareResult";
import { dayKey, isPast, playDay } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { RANK, SUITS, autoHome, bestSpot, cardsFrom, deal, dealFor, isWon, move, pinkSuit, type Card, type Spot, type State } from "@/lib/freecell";
import { addFlag } from "@/lib/trophyFlags";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-freecell", STATS = "mm-freecell-stats";
const cardName = (c: Card) => `${RANK[c.rank] === "A" ? "Ace" : RANK[c.rank]} of ${SUITS[c.suit]}`;
function Face({ c }: { c: Card }) {
  return (
    <span className={`pc-card ${pinkSuit(c.suit) ? "pink" : "brown"}`}>
      <span className="pc-corner">{RANK[c.rank]}<i>{SUITS[c.suit]}</i></span>
      <span className="pc-mid" aria-hidden="true">{SUITS[c.suit]}</span>
    </span>
  );
}
const sameSpot = (a: Spot | null, b: Spot) => !!a && a.kind === b.kind && (a.kind === "found" || ("i" in a && "i" in b && a.i === b.i && (a.kind !== "col" || (a as { at?: number }).at === (b as { at?: number }).at)));

export default function CafeFreecell() {
  const { toast } = useStore();
  const [date, setDate] = useState("");
  const past = isPast(date);
  const [practice, setPractice] = useState(false);
  const [s, setS] = useState<State | null>(null);
  const [history, setHistory] = useState<State[]>([]);
  const [sel, setSel] = useState<Spot | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState({ played: 0, won: 0 });
  useEffect(() => {
    const d = playDay();
    setDate(d);
    try { setName(localStorage.getItem("mm-game-name") ?? ""); setStats({ played: 0, won: 0, ...JSON.parse(localStorage.getItem(STATS) ?? "{}") }); } catch {}
    let v: { date?: string; s?: State; start?: number; doneMs?: number; saved?: boolean } | null = null;
    try { v = JSON.parse(localStorage.getItem(dayKey(KEY)) ?? "null"); } catch {}
    if (v?.date === d && v.s) { setS(v.s); setStart(v.start ?? null); setDoneMs(v.doneMs ?? null); setSaved(!!v.saved); }
    else setS(autoHome(dealFor(d)));
    setNow(Date.now());
    fetch(`/api/daily-scores?game=freecell&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  useEffect(() => { if (date && s && !practice) try { localStorage.setItem(dayKey(KEY), JSON.stringify({ date, s, start, doneMs, saved })); } catch {} }, [date, s, start, doneMs, saved, practice]);
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [start, doneMs]);
  if (!s) return <div className="page"><p className="muted">Shuffling…</p></div>;
  const done = doneMs !== null;

  function bump(won: boolean) {
    const next = { played: stats.played + 1, won: stats.won + (won ? 1 : 0) };
    setStats(next); try { localStorage.setItem(STATS, JSON.stringify(next)); } catch {}
  }
  function go(from: Spot, to: Spot) {
    const n = move(s!, from, to);
    if (!n) return false;
    const t = start ?? Date.now();
    if (!start) { setStart(t); setNow(t); }
    const home = autoHome(n);
    setHistory([...history, s!]); setS(home); setSel(null);
    if (isWon(home)) {
      setDoneMs(Date.now() - t); bump(true); addFlag("freecell-win");
      toast("Every suit home! 🃏🎉");
    }
    return true;
  }
  function tap(spot: Spot) {
    if (done) return;
    // Tapping the same card again sends it to the best place it can go
    if (sameSpot(sel, spot)) { const to = bestSpot(s!, spot); if (!to || !go(spot, to)) { setSel(null); toast("Nowhere for that to go."); } return; }
    if (sel) {
      const to: Spot = spot.kind === "col" ? { kind: "col", i: spot.i } : spot;
      if (go(sel, to)) return;
    }
    if (spot.kind !== "found" && cardsFrom(s!, spot).length) setSel(spot);
    else if (sel) { toast(spot.kind === "col" && sel.kind === "col" ? "That run is too long to move with the free cells you have, or doesn't fit there." : "That can't go there."); setSel(null); }
  }
  function newDeal(practiceDeal: boolean) {
    if (!done && history.length) bump(false);
    setPractice(practiceDeal);
    setS(autoHome(practiceDeal ? deal(Math.random) : dealFor(date)));
    setHistory([]); setSel(null); setStart(null); setDoneMs(null); setSaved(false);
  }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "freecell", ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  const elapsed = doneMs ?? (start ? now - start : 0);
  const selCards = sel ? cardsFrom(s, sel) : [];
  const isSel = (c: Card) => selCards.some((x) => x.suit === c.suit && x.rank === c.rank);
  return (
    <div className="page" style={{ maxWidth: "42rem" }}>
      <p className="eyebrow">{practice ? "a practice deal" : "today's deal"}</p>
      {!practice && <ArchiveNote date={date} path="/cafe-freecell" />}
      <h1 className="h2">Café <em>FreeCell</em></h1>
      <p className="small muted">Every card is dealt face up. Build each suit from ace to king on the spaces at the top right. In the columns, stack down in alternating colours (brown ☕🍫 on pink 🍓🌸). The four free cells at the top left hold one card each, and you can move a run of cards at once if there are enough free cells and empty columns to shuffle it through. Tap a card, then where it goes, or tap it twice to send it to the best spot.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => { const p = history[history.length - 1]; if (p) { setS(p); setHistory(history.slice(0, -1)); setSel(null); } }} disabled={!history.length || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => newDeal(false)}>{practice ? "Back to today's deal" : "Restart"}</button>
        <button className="btn btn-ghost btn-sm" onClick={() => newDeal(true)}>Practice deal</button>
        <span className="memory-stats"><span>Moves <b>{s.moves}</b></span><span>⏱ {clock(elapsed)}</span></span>
      </div>
      <div className="pc-table fc-table">
        <div className="fc-top">
          {s.cells.map((c, i) => (
            <button key={`c${i}`} className={`pc-slot fc-cell ${sel?.kind === "cell" && sel.i === i ? "sel" : ""}`} onClick={() => tap({ kind: "cell", i })} aria-label={c ? `Free cell ${i + 1}: ${cardName(c)}` : `Free cell ${i + 1}, empty`}>
              {c ? <Face c={c} /> : <span className="pc-empty">·</span>}
            </button>
          ))}
          {s.found.map((r, suit) => (
            <button key={`f${suit}`} className="pc-slot" onClick={() => tap({ kind: "found" })} aria-label={r ? `Home for ${SUITS[suit]}: up to ${RANK[r]}` : `Home for ${SUITS[suit]}, empty`}>
              {r ? <Face c={{ suit, rank: r }} /> : <span className="pc-empty">{SUITS[suit]}</span>}
            </button>
          ))}
        </div>
        <div className="fc-cols">
          {s.cols.map((col, i) => (
            <div key={i} className="pc-pile fc-pile" style={{ ["--n" as string]: col.length }} onClick={(e) => { if (e.target === e.currentTarget) tap({ kind: "col", i }); }}>
              {!col.length && <button className="pc-btn" onClick={() => tap({ kind: "col", i })} aria-label={`Column ${i + 1}, empty`}><span className="pc-empty"> </span></button>}
              {col.map((c, k) => (
                <button key={k} className={`pc-btn pc-in-pile ${isSel(c) ? "fc-sel" : ""}`} style={{ ["--k" as string]: k, ["--down" as string]: 0 }}
                  onClick={() => tap({ kind: "col", i, at: k })} aria-label={`Column ${i + 1}: ${cardName(c)}${k === col.length - 1 ? ", on top" : ""}`}>
                  <Face c={c} />
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      {done && (
        <section className="card memory-done" aria-live="polite">
          <b>Cleared in {clock(doneMs)}, {s.moves} moves 🎉</b>
          {practice ? <p className="small" style={{ margin: 0 }}>Practice deals don&apos;t go on the board.</p> : past ? <p className="small" style={{ margin: 0 }}>Archive days don&apos;t go on the board.</p> : !saved ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓</p>}
          <button className="btn btn-ghost btn-sm" onClick={() => newDeal(true)}>Another deal</button>
          {!practice && <ShareResult title="Café FreeCell" date={date} />}
        </section>
      )}
      <p className="small muted" style={{ marginTop: "1rem" }}>Won {stats.won} of {stats.played} deals on this device.</p>
      <p className="tiny muted">Cards go home on their own once nothing could still need them. Almost every FreeCell deal can be won with careful play. Today&apos;s deal is the same for everyone and goes on the board; practice deals are fresh shuffles just for you.</p>
      {board && !past && !practice && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">Today&apos;s quickest</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{clock(t.ms)}</b></li>)}</ol> : <p className="small muted">No times yet today. Clear the first deal.</p>}
        </section>
      )}
    </div>
  );
}
