"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { END_AT, HEARTS, NAMES_PASS, PLAYERS, RANKS, SUITS, chooseCard, choosePass, dealHands, doPass, gameOver, handOver, handScores, label, lastWinner, leaders, legal, passTo, playCard, points, same, startHand, type Card, type Hand, type Level } from "@/lib/hearts";

const STATS = "mm-hearts";
type Rec = { won: number; lost: number };
const blank = (): Record<Level, Rec> => ({ easy: { won: 0, lost: 0 }, hard: { won: 0, lost: 0 } });
type Phase = "pass" | "play" | "scores" | "over";
const red = (c: Card) => c.suit === 1 || c.suit === HEARTS;
const SEAT = ["south", "west", "north", "east"];

function Face({ c, dim }: { c: Card; dim?: boolean }) {
  return <span className={`hc-card ${red(c) ? "red" : ""} ${dim ? "dim" : ""}`}><b>{RANKS[c.rank]}</b><i>{SUITS[c.suit]}</i></span>;
}

export default function CafeHearts() {
  const { toast } = useStore();
  const [level, setLevel] = useState<Level>("easy");
  const [stats, setStats] = useState(blank());
  const [totals, setTotals] = useState([0, 0, 0, 0]);
  const [handNo, setHandNo] = useState(0);
  const [phase, setPhase] = useState<Phase>("pass");
  const [dealt, setDealt] = useState<Card[][] | null>(null);
  const [picks, setPicks] = useState<Card[]>([]);
  const [h, setH] = useState<Hand | null>(null);
  const [flash, setFlash] = useState<{ trick: { p: number; c: Card }[]; winner: number } | null>(null);
  const [lastScores, setLastScores] = useState<number[] | null>(null);
  const [got, setGot] = useState<Card[]>([]);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (v) { setStats({ ...blank(), ...v.stats }); if (v.level === "hard") setLevel("hard"); } } catch {}
    newHand(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function saveStats(next: Record<Level, Rec>, lv = level) { setStats(next); try { localStorage.setItem(STATS, JSON.stringify({ stats: next, level: lv })); } catch {} }

  function newHand(n: number) {
    const hands = dealHands(Math.random);
    setHandNo(n); setPicks([]); setGot([]); setFlash(null); setLastScores(null);
    if (n % 4 === 3) { setDealt(null); setH(startHand(hands)); setPhase("play"); }
    else { setDealt(hands); setH(null); setPhase("pass"); }
  }
  function pass() {
    if (!dealt || picks.length !== 3) return;
    const all = dealt.map((hand, p) => (p === 0 ? picks : choosePass(hand, level)));
    const swapped = doPass(dealt, all, handNo);
    const from = [0, 1, 2, 3].find((p) => passTo(handNo, p) === 0)!;
    setGot(all[from]);
    setH(startHand(swapped)); setPhase("play"); setDealt(null);
  }
  function finishTrick(next: Hand, trick: { p: number; c: Card }[]) {
    setFlash({ trick, winner: lastWinner(trick) });
    setTimeout(() => {
      setFlash(null); setH(next);
      if (handOver(next)) {
        const sc = handScores(next), t = totals.map((x, i) => x + sc[i]);
        setLastScores(sc); setTotals(t);
        if (sc.filter((x) => x === 26).length === 3) toast(`${PLAYERS[sc.indexOf(0)]} shot the moon! 🌙`);
        if (gameOver(t)) {
          setPhase("over");
          const won = leaders(t).includes(0);
          saveStats({ ...stats, [level]: { ...stats[level], [won ? "won" : "lost"]: stats[level][won ? "won" : "lost"] + 1 } });
          toast(won ? "You win the game! ♥️🎉" : `${PLAYERS[leaders(t)[0]]} wins the game.`);
        } else setPhase("scores");
      }
    }, 1100);
  }
  function play(p: number, c: Card) {
    if (!h) return;
    const trick = [...h.trick, { p, c }];
    const next = playCard(h, p, c);
    if (trick.length === 4) { setH({ ...h, hands: next.hands, trick }); finishTrick(next, trick); }
    else setH(next);
  }
  // The computer players take their turns
  useEffect(() => {
    if (phase !== "play" || !h || flash || h.turn === 0 || h.trick.length === 4 || handOver(h)) return;
    const id = setTimeout(() => play(h.turn, chooseCard(h, h.turn, level)), 550);
    return () => clearTimeout(id);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  function tapCard(c: Card) {
    if (phase === "pass") { setPicks(picks.some((x) => same(x, c)) ? picks.filter((x) => !same(x, c)) : picks.length < 3 ? [...picks, c] : picks); return; }
    if (phase !== "play" || !h || flash || h.turn !== 0 || h.trick.length === 4) return;
    if (!legal(h, 0).some((x) => same(x, c))) {
      const lead = h.trick[0]?.c.suit;
      toast(h.tricks === 0 && !h.trick.length ? "The 2♣ starts the first trick." : lead !== undefined ? `You have to follow suit: play a ${SUITS[lead]}.` : "Hearts can't be led until one has been played.");
      return;
    }
    play(0, c);
  }
  function newGame(lv = level) {
    if (phase !== "over" && (h?.tricks || handNo)) saveStats({ ...stats, [level]: { ...stats[level], lost: stats[level].lost + 1 } }, lv);
    else if (lv !== level) saveStats(stats, lv);
    setLevel(lv); setTotals([0, 0, 0, 0]); newHand(0);
  }
  const mine = phase === "pass" ? dealt?.[0] ?? [] : h?.hands[0] ?? [];
  const canPlay = phase === "play" && h && !flash && h.turn === 0 && h.trick.length < 4 ? legal(h, 0) : [];
  const table = flash?.trick ?? h?.trick ?? [];
  const taken = h ? h.taken.map((cs) => cs.reduce((s, c) => s + points(c), 0)) : [0, 0, 0, 0];
  const status = phase === "pass" ? `Pick 3 cards to pass ${NAMES_PASS[handNo % 4]} to ${PLAYERS[passTo(handNo, 0)]}`
    : phase === "play" && h ? (flash ? `${PLAYERS[flash.winner]} take${flash.winner ? "s" : ""} the trick` : h.turn === 0 ? "Your turn" : `${PLAYERS[h.turn]} is thinking…`)
    : phase === "scores" ? "Hand over" : "Game over";
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">a card game</p>
      <h1 className="h2">Café <em>hearts</em></h1>
      <p className="small muted">You against Leela, Omar and Rosa. Each hand, pass three cards, then play thirteen tricks: follow the suit that was led if you can, and the highest card of that suit wins. Every ♥ you take is a point, and the queen of ♠ is 13. Low score wins once someone reaches {END_AT}. Or take all of them to &quot;shoot the moon&quot;, and everyone else gets 26.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {(["easy", "hard"] as const).map((lv) => <button key={lv} className={`chip ${level === lv ? "on" : ""}`} aria-pressed={level === lv} onClick={() => lv !== level && newGame(lv)}>{lv === "easy" ? "Easy" : "Hard"}</button>)}
        <button className="btn btn-ghost btn-sm" onClick={() => newGame()}>New game</button>
      </div>
      <table className="hh-scores">
        <thead><tr><th scope="col" className="sr-only">Player</th>{PLAYERS.map((p, i) => <th key={p} scope="col" className={h && h.turn === i && phase === "play" && !flash ? "on" : ""}>{p}</th>)}</tr></thead>
        <tbody>
          <tr><th scope="row">Game</th>{totals.map((t, i) => <td key={i}><b>{t}</b></td>)}</tr>
          <tr><th scope="row">This hand</th>{taken.map((t, i) => <td key={i}>{t}</td>)}</tr>
        </tbody>
      </table>
      <p className="center small" aria-live="polite" style={{ margin: "0.4rem 0" }}><b>{status}</b>{h?.broken && phase === "play" ? <span className="muted"> · hearts are broken</span> : null}</p>
      <div className="hh-table" aria-label="The table">
        {[1, 2, 3].map((p) => <span key={p} className={`hh-seat ${SEAT[p]}`}>{PLAYERS[p]} <small className="muted">{(h?.hands[p].length ?? 13)} cards</small></span>)}
        {table.map((t) => <span key={t.p} className={`hh-play ${SEAT[t.p]} ${flash?.winner === t.p ? "win" : ""}`} aria-label={`${PLAYERS[t.p]} played ${label(t.c)}`}><Face c={t.c} /></span>)}
      </div>
      {got.length > 0 && phase === "play" && h && h.tricks === 0 && <p className="tiny muted center">You were passed {got.map(label).join(", ")}.</p>}
      <div className="hh-hand" aria-label="Your hand">
        {mine.map((c) => {
          const ok = phase === "pass" || canPlay.some((x) => same(x, c));
          const picked = picks.some((x) => same(x, c));
          return (
            <button key={label(c)} className={`hh-btn ${picked ? "picked" : ""} ${ok && phase === "play" && canPlay.length ? "ok" : ""}`} onClick={() => tapCard(c)}
              aria-label={`${label(c)}${picked ? ", picked to pass" : ""}${phase === "play" && canPlay.length && !ok ? ", can't play this now" : ""}`}>
              <Face c={c} dim={phase === "play" && canPlay.length > 0 && !ok} />
            </button>
          );
        })}
      </div>
      {phase === "pass" && <p className="center"><button className="btn btn-pink btn-sm" onClick={pass} disabled={picks.length !== 3}>Pass {picks.length}/3 to {PLAYERS[passTo(handNo, 0)]}</button></p>}
      {(phase === "scores" || phase === "over") && lastScores && (
        <section className="card memory-done" aria-live="polite">
          <b>{phase === "over" ? (leaders(totals).includes(0) ? "You win the game! 🎉" : `${leaders(totals).map((i) => PLAYERS[i]).join(" and ")} win${leaders(totals).length === 1 && leaders(totals)[0] !== 0 ? "s" : ""}`) : "Hand over"}</b>
          <p className="small" style={{ margin: 0 }}>This hand: {lastScores.map((x, i) => `${PLAYERS[i]} ${x}`).join(" · ")}</p>
          {phase === "scores" ? <button className="btn btn-pink btn-sm" onClick={() => newHand(handNo + 1)}>Next hand</button> : <button className="btn btn-pink btn-sm" onClick={() => newGame()}>Play again</button>}
        </section>
      )}
      <p className="small muted" style={{ marginTop: "1rem" }}>On {level}: won {stats[level].won} · lost {stats[level].lost}</p>
      <p className="tiny muted">Passing goes left, right, across, then a hand with no passing. Easy players make careless plays; hard ones duck under tricks, dump the queen on someone else and pass their dangerous cards. Your record is kept on this device, and leaving a game halfway counts as a loss.</p>
    </div>
  );
}
