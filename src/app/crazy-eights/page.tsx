"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { RANK, SUITS, pinkSuit } from "@/lib/patience";
import { choose, deal, drawCard, pass, play, playable, top, type Card, type Level, type State } from "@/lib/crazyEights";
import { addFlag } from "@/lib/trophyFlags";

const STATS = "mm-eights";
type Rec = { won: number; lost: number };
function Face({ c, dim }: { c: Card; dim?: boolean }) {
  return (
    <span className={`pc-card ${pinkSuit(c.suit) ? "pink" : "brown"}`} style={dim ? { opacity: 0.45 } : undefined}>
      <span className="pc-corner">{RANK[c.rank]}<i>{SUITS[c.suit]}</i></span>
      <span className="pc-mid" aria-hidden="true">{SUITS[c.suit]}</span>
    </span>
  );
}
const name = (c: Card) => `${RANK[c.rank]} of ${SUITS[c.suit]}`;

export default function CrazyEights() {
  const { toast } = useStore();
  const [level, setLevel] = useState<Level>("easy");
  const [s, setS] = useState<State | null>(null);
  const [calling, setCalling] = useState<Card | null>(null);
  const [stats, setStats] = useState<Record<Level, Rec>>({ easy: { won: 0, lost: 0 }, hard: { won: 0, lost: 0 } });
  const [recorded, setRecorded] = useState(false);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (v) { setStats({ easy: { won: 0, lost: 0 }, hard: { won: 0, lost: 0 }, ...v.stats }); if (v.level === "hard") setLevel("hard"); } } catch {}
    setS(deal(Math.random));
  }, []);
  function saveStats(next: Record<Level, Rec>, lv = level) { setStats(next); try { localStorage.setItem(STATS, JSON.stringify({ stats: next, level: lv })); } catch {} }
  // The computer's turn
  useEffect(() => {
    if (!s || s.turn !== 1 || s.winner !== null) return;
    const id = setTimeout(() => {
      const c = choose(s, level);
      const n = c === "draw" ? drawCard(s, Math.random) : c === "pass" ? pass(s) : play(s, c.card, c.call);
      if (n) { if (c !== "draw" && c !== "pass" && c.card.rank === 8) toast(`The computer played an 8 and called ${SUITS[n.suit]}`); setS(n); }
    }, 650);
    return () => clearTimeout(id);
  }, [s, level]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!s || s.winner === null || recorded) return;
    setRecorded(true);
    const won = s.winner === 0;
    if (won) addFlag("eights-win");
    saveStats({ ...stats, [level]: { ...stats[level], [won ? "won" : "lost"]: stats[level][won ? "won" : "lost"] + 1 } });
    toast(won ? "Out of cards: you win! 🃏🎉" : "The computer went out first.");
  }, [s?.winner]); // eslint-disable-line react-hooks/exhaustive-deps
  function newGame(lv = level) {
    if (s && s.winner === null && (s.pile.length > 1 || s.drew)) saveStats({ ...stats, [level]: { ...stats[level], lost: stats[level].lost + 1 } }, lv);
    else if (lv !== level) saveStats(stats, lv);
    setLevel(lv); setS(deal(Math.random)); setRecorded(false); setCalling(null);
  }
  function tap(c: Card) {
    if (!s || s.turn !== 0 || s.winner !== null) return;
    if (!playable(s, c)) return toast(`Play a ${SUITS[s.suit]}, a ${RANK[top(s).rank]}, or an 8.`);
    if (c.rank === 8) { setCalling(c); return; }
    setS(play(s, c));
  }
  if (!s) return <div className="page"><p className="muted">Shuffling…</p></div>;
  const mine = s.hands[0], canPlay = s.turn === 0 && s.winner === null && mine.some((c) => playable(s, c));
  const status = s.winner !== null ? (s.winner === 0 ? "You win! 🎉" : "The computer wins") : s.turn === 1 ? "The computer's thinking…" : calling ? "Pick the next suit" : canPlay ? "Your turn" : s.drew ? "Nothing fits: pass" : "Nothing fits: draw a card";
  return (
    <div className="page" style={{ maxWidth: "36rem" }}>
      <p className="eyebrow">a card game</p>
      <h1 className="h2">Crazy <em>eights</em></h1>
      <p className="small muted">You and the computer take turns putting a card on the pile: it has to match the top card&apos;s suit or number. An 8 goes on anything, and you choose the suit that comes next. If you can&apos;t go, draw a card, and play it if you can. First to get rid of all their cards wins.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {(["easy", "hard"] as const).map((lv) => <button key={lv} className={`chip ${level === lv ? "on" : ""}`} aria-pressed={level === lv} onClick={() => lv !== level && newGame(lv)}>{lv === "easy" ? "Easy" : "Hard"}</button>)}
        <button className="btn btn-ghost btn-sm" onClick={() => newGame()}>New game</button>
      </div>
      <p className="center small" aria-live="polite" style={{ margin: "0.8rem 0 0.4rem" }}><b>{status}</b></p>
      <div className="ce-them" aria-label={`The computer has ${s.hands[1].length} cards`}>
        {s.hands[1].map((_, k) => <span key={k} className="pc-card down" />)}
      </div>
      <div className="ce-middle">
        <button className="pc-slot" onClick={() => { if (s.turn === 0 && !canPlay) { const n = s.drew ? pass(s) : drawCard(s, Math.random); if (n) setS(n); } else if (s.turn === 0) toast("You've got a card that fits."); }} aria-label={s.drew ? "Pass" : `Draw a card, ${s.stock.length} left`}>
          <span className="pc-card down" />
        </button>
        <div className="pc-slot" aria-label={`Top card: ${name(top(s))}`}><Face c={top(s)} /></div>
        <span className="ce-suit" aria-label={`Suit to play: ${SUITS[s.suit]}`}>{SUITS[s.suit]}</span>
      </div>
      {s.turn === 0 && s.drew && !canPlay && s.winner === null && <p className="center"><button className="btn btn-pink btn-sm" onClick={() => setS(pass(s))}>Pass</button></p>}
      {calling && (
        <div className="cc-promo" role="dialog" aria-label="Pick a suit">
          <span className="small">Next suit:</span>
          {[0, 1, 2, 3].map((su) => <button key={su} className="btn btn-ghost" onClick={() => { setS(play(s, calling, su)); setCalling(null); }} aria-label={SUITS[su]}>{SUITS[su]}</button>)}
        </div>
      )}
      <div className="ce-hand" aria-label="Your hand">
        {mine.map((c, k) => (
          <button key={k} className="pc-btn ce-card" onClick={() => tap(c)} aria-label={`${name(c)}${playable(s, c) ? "" : ", doesn't fit"}`}>
            <Face c={c} dim={s.turn === 0 && !playable(s, c)} />
          </button>
        ))}
      </div>
      {s.winner !== null && <p className="center"><button className="btn btn-pink btn-sm" onClick={() => newGame()}>Play again</button></p>}
      <p className="small muted" style={{ marginTop: "1rem" }}>On {level}: won {stats[level].won} · lost {stats[level].lost}</p>
      <p className="tiny muted">Easy plays any card that fits. Hard keeps its 8s for a tight spot and sticks to the suit it holds most of. It&apos;s a game of luck as much as skill. Your record is kept on this device.</p>
    </div>
  );
}
