"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { RANK, SUITS, pinkSuit } from "@/lib/patience";
import { computerTurn, deal, drawFrom, isMeld, layDown, layOff, same, throwAway, type Card, type Level, type State } from "@/lib/rummy";
import { addFlag } from "@/lib/trophyFlags";

const STATS = "mm-rummy";
type Rec = { won: number; lost: number };
function Face({ c }: { c: Card }) {
  return (
    <span className={`pc-card ${pinkSuit(c.suit) ? "pink" : "brown"}`}>
      <span className="pc-corner">{RANK[c.rank]}<i>{SUITS[c.suit]}</i></span>
      <span className="pc-mid" aria-hidden="true">{SUITS[c.suit]}</span>
    </span>
  );
}
const name = (c: Card) => `${RANK[c.rank]} of ${SUITS[c.suit]}`;
const order = (h: Card[]) => [...h].sort((a, b) => a.suit - b.suit || a.rank - b.rank);

export default function CafeRummy() {
  const { toast } = useStore();
  const [level, setLevel] = useState<Level>("easy");
  const [s, setS] = useState<State | null>(null);
  const [sel, setSel] = useState<Card[]>([]);
  const [stats, setStats] = useState<Record<Level, Rec>>({ easy: { won: 0, lost: 0 }, hard: { won: 0, lost: 0 } });
  const [recorded, setRecorded] = useState(false);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (v) { setStats({ easy: { won: 0, lost: 0 }, hard: { won: 0, lost: 0 }, ...v.stats }); if (v.level === "hard") setLevel("hard"); } } catch {}
    setS(deal(Math.random));
  }, []);
  function saveStats(next: Record<Level, Rec>, lv = level) { setStats(next); try { localStorage.setItem(STATS, JSON.stringify({ stats: next, level: lv })); } catch {} }
  useEffect(() => {
    if (!s || s.turn !== 1 || s.winner !== null) return;
    const id = setTimeout(() => {
      const before = s.melds.length;
      const n = computerTurn(s, level);
      if (n.melds.length > before) toast(`The computer laid down ${n.melds.length - before === 1 ? "a meld" : `${n.melds.length - before} melds`}.`);
      setS(n);
    }, 800);
    return () => clearTimeout(id);
  }, [s, level]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!s || s.winner === null || recorded) return;
    setRecorded(true);
    const won = s.winner === 0;
    if (won) addFlag("rummy-win");
    saveStats({ ...stats, [level]: { ...stats[level], [won ? "won" : "lost"]: stats[level][won ? "won" : "lost"] + 1 } });
    toast(won ? "Out of cards: you win! 🃏🎉" : "The computer went out.");
  }, [s?.winner]); // eslint-disable-line react-hooks/exhaustive-deps
  function newGame(lv = level) {
    if (s && s.winner === null && (s.melds.length || s.discard.length > 1)) saveStats({ ...stats, [level]: { ...stats[level], lost: stats[level].lost + 1 } }, lv);
    else if (lv !== level) saveStats(stats, lv);
    setLevel(lv); setS(deal(Math.random)); setSel([]); setRecorded(false);
  }
  if (!s) return <div className="page"><p className="muted">Shuffling…</p></div>;
  const mine = order(s.hands[0]), myTurn = s.turn === 0 && s.winner === null;
  const picked = (c: Card) => sel.some((x) => same(x, c));
  function pick(c: Card) { if (myTurn) setSel(picked(c) ? sel.filter((x) => !same(x, c)) : [...sel, c]); }
  function draw(from: "stock" | "discard") { if (!myTurn) return; const n = drawFrom(s!, from); if (n) setS(n); else if (s!.drawn) toast("You've drawn this turn. Lay down, or throw a card away."); }
  function lay() { const n = layDown(s!, sel); if (!n) return toast(s!.drawn ? "That's not a set or a run." : "Draw a card first."); setS(n); setSel([]); }
  function addTo(k: number) { if (sel.length !== 1) return toast("Pick one card to add to a meld."); const n = layOff(s!, sel[0], k); if (!n) return toast(s!.drawn ? "That card doesn't fit there." : "Draw a card first."); setS(n); setSel([]); }
  function discard() { if (sel.length !== 1) return toast("Pick one card to throw away."); const n = throwAway(s!, sel[0]); if (!n) return toast("Draw a card first."); setS(n); setSel([]); }
  const top = s.discard[s.discard.length - 1];
  const status = s.winner !== null ? (s.winner === 0 ? "You win! 🎉" : "The computer wins") : s.turn === 1 ? "The computer's turn…" : !s.drawn ? "Draw from the pile or the discard" : "Lay down melds, then throw one away";
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">a card game</p>
      <h1 className="h2">Café <em>rummy</em></h1>
      <p className="small muted">Each turn, draw a card, from the pile or the top of the discards. Then lay down any sets (three or four of a number) or runs (three or more in a row in one suit, ace low), and add cards onto melds already on the table. Finish by throwing one card away. First to get rid of every card wins.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {(["easy", "hard"] as const).map((lv) => <button key={lv} className={`chip ${level === lv ? "on" : ""}`} aria-pressed={level === lv} onClick={() => lv !== level && newGame(lv)}>{lv === "easy" ? "Easy" : "Hard"}</button>)}
        <button className="btn btn-ghost btn-sm" onClick={() => newGame()}>New game</button>
      </div>
      <p className="center small" aria-live="polite" style={{ margin: "0.8rem 0 0.4rem" }}><b>{status}</b></p>
      <div className="ce-them" aria-label={`The computer has ${s.hands[1].length} cards`}>{s.hands[1].map((_, k) => <span key={k} className="pc-card down" />)}</div>
      <div className="ce-middle">
        <button className="pc-slot" onClick={() => draw("stock")} aria-label={`Draw from the pile, ${s.stock.length} left`}><span className="pc-card down" /></button>
        <button className="pc-slot" onClick={() => draw("discard")} aria-label={top ? `Take the ${name(top)} from the discards` : "No discards"}>{top ? <Face c={top} /> : <span className="pc-empty"> </span>}</button>
      </div>
      {s.melds.length > 0 && (
        <div className="ru-melds" aria-label="Melds on the table">
          {s.melds.map((m, k) => (
            <button key={k} className="ru-meld" onClick={() => addTo(k)} aria-label={`Meld: ${m.map(name).join(", ")}${sel.length === 1 && myTurn ? ". Tap to add your card" : ""}`}>
              {m.map((c, j) => <span key={j} className="ru-mini"><Face c={c} /></span>)}
            </button>
          ))}
        </div>
      )}
      <div className="ce-hand" aria-label="Your hand">
        {mine.map((c) => (
          <button key={`${c.suit}-${c.rank}`} className={`pc-btn ce-card ${picked(c) ? "fc-sel ru-picked" : ""}`} onClick={() => pick(c)} aria-pressed={picked(c)} aria-label={name(c)}><Face c={c} /></button>
        ))}
      </div>
      {myTurn && s.drawn && (
        <div className="row" style={{ justifyContent: "center", gap: "0.5rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
          <button className="btn btn-pink btn-sm" onClick={lay} disabled={sel.length < 3 || !isMeld(sel)}>Lay down {sel.length >= 3 && isMeld(sel) ? "✓" : ""}</button>
          <button className="btn btn-ghost btn-sm" onClick={discard} disabled={sel.length !== 1}>Throw away</button>
        </div>
      )}
      {s.winner !== null && <p className="center"><button className="btn btn-pink btn-sm" onClick={() => newGame()}>Play again</button></p>}
      <p className="small muted" style={{ marginTop: "1rem" }}>On {level}: won {stats[level].won} · lost {stats[level].lost}</p>
      <p className="tiny muted">Tap cards to pick them, then lay them down, or tap a meld on the table to add one. Easy plays fast and loose; hard watches what it keeps. Your record is kept on this device.</p>
    </div>
  );
}
