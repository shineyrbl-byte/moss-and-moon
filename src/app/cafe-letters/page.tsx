"use client";
import "./page.css";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { CENTRE, MAX_LEN, N, PREMIUM, VALUE, computerMoves, evaluate, newGame, passOrSwap, playMove, type Game, type Placement } from "@/lib/cafeLetters";
import { shuffled } from "@/lib/gameOrders";
import { addFlag } from "@/lib/trophyFlags";

type Level = "easy" | "hard";
const STATS = "mm-letters";
type Rec = { won: number; lost: number; best: number };
const LABEL: Record<string, string> = { dl: "2L", tl: "3L", dw: "2W", tw: "3W" };

export default function CafeLetters() {
  const { toast } = useStore();
  const [level, setLevel] = useState<Level>("easy");
  const [g, setG] = useState<Game | null>(null);
  const [placed, setPlaced] = useState<{ at: number; k: number }[]>([]); // tiles you've put down this turn (k = rack slot)
  const [sel, setSel] = useState<number | null>(null);
  const [order, setOrder] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [swapping, setSwapping] = useState<number[] | null>(null);
  const [stats, setStats] = useState<Record<Level, Rec>>({ easy: { won: 0, lost: 0, best: 0 }, hard: { won: 0, lost: 0, best: 0 } });
  const [recorded, setRecorded] = useState(false);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (v) { setStats({ easy: { won: 0, lost: 0, best: 0 }, hard: { won: 0, lost: 0, best: 0 }, ...v.stats }); if (v.level === "hard") setLevel("hard"); } } catch {}
    setG(newGame(Math.random));
  }, []);
  function saveStats(next: Record<Level, Rec>, lv = level) { setStats(next); try { localStorage.setItem(STATS, JSON.stringify({ stats: next, level: lv })); } catch {} }
  // The computer's turn
  useEffect(() => {
    if (!g || g.turn !== 1 || g.over) return;
    const id = setTimeout(() => {
      const moves = computerMoves(g);
      if (!moves.length) { setG(passOrSwap(g, g.bag.length >= 7 ? shuffled(g.racks[1], Math.random).slice(0, 4) : [], Math.random)); toast(g.bag.length >= 7 ? "The computer swapped some tiles." : "The computer passed."); return; }
      // Easy picks from the middle of what it found; hard takes the best
      const m = level === "hard" ? moves[0] : moves[Math.min(moves.length - 1, Math.floor(moves.length * (0.3 + Math.random() * 0.5)))];
      const n = playMove(g, m.move);
      if (!("why" in n)) setG(n);
    }, 700);
    return () => clearTimeout(id);
  }, [g, level]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!g?.over || recorded) return;
    setRecorded(true);
    const won = g.scores[0] > g.scores[1];
    if (won) addFlag(level === "hard" ? "letters-hard" : "letters-win");
    saveStats({ ...stats, [level]: { won: stats[level].won + (won ? 1 : 0), lost: stats[level].lost + (won ? 0 : 1), best: Math.max(stats[level].best, g.scores[0]) } });
    toast(won ? `You win, ${g.scores[0]} to ${g.scores[1]}! 🔤🎉` : g.scores[0] === g.scores[1] ? "A draw!" : `The computer wins, ${g.scores[1]} to ${g.scores[0]}.`);
  }, [g?.over]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!g) return <div className="page"><p className="muted">Filling the tile bag…</p></div>;
  const rack = g.racks[0], myTurn = g.turn === 0 && !g.over;
  const move: Placement = placed.map((p) => ({ at: p.at, letter: rack[p.k] }));
  const preview = placed.length ? evaluate(g.board, move) : null;
  const inRack = order.filter((k) => k < rack.length && !placed.some((p) => p.k === k));
  function reset(next: Game) { setG(next); setPlaced([]); setSel(null); setSwapping(null); setOrder([0, 1, 2, 3, 4, 5, 6]); }
  function newMatch(lv = level) {
    if (!g!.over && g!.board.some(Boolean)) saveStats({ ...stats, [level]: { ...stats[level], lost: stats[level].lost + 1 } }, lv);
    else if (lv !== level) saveStats(stats, lv);
    setLevel(lv); setRecorded(false); reset(newGame(Math.random));
  }
  function tapSquare(i: number) {
    if (!myTurn) return;
    const mine = placed.find((p) => p.at === i);
    if (mine) { setPlaced(placed.filter((p) => p !== mine)); return; }
    if (g!.board[i]) return;
    if (sel === null) return toast("Pick a tile from your rack first.");
    setPlaced([...placed, { at: i, k: sel }]);
    const rest = inRack.filter((k) => k !== sel);
    setSel(rest[0] ?? null);
  }
  function submit() {
    const n = playMove(g!, move);
    if ("why" in n) return toast(n.why);
    toast(`${n.last!.words.map((w) => w.toUpperCase()).join(", ")}: ${n.last!.points} points`);
    if (n.last!.points >= 40) addFlag("letters-40");
    reset(n);
  }
  const last = g.last;
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">a word game</p>
      <h1 className="h2">Café <em>letters</em></h1>
      <p className="small muted">A crossword tile game for two on a small board. Put down tiles in one straight line to make words, joined on to what&apos;s there (the first word covers the ★). Every word on the board must be 2 to {MAX_LEN} letters. Pink squares double or triple a letter, brown ones the whole word. Highest score when the tiles run out wins.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {(["easy", "hard"] as const).map((lv) => <button key={lv} className={`chip ${level === lv ? "on" : ""}`} aria-pressed={level === lv} onClick={() => lv !== level && newMatch(lv)}>{lv === "easy" ? "Easy" : "Hard"}</button>)}
        <button className="btn btn-ghost btn-sm" onClick={() => newMatch()}>New game</button>
      </div>
      <div className="rv-score" aria-live="polite">
        <span className={g.turn === 0 && !g.over ? "on" : ""}>You <b>{g.scores[0]}</b></span>
        <span className="small muted">{g.bag.length} in the bag</span>
        <span className={g.turn === 1 && !g.over ? "on" : ""}><b>{g.scores[1]}</b> Computer</span>
      </div>
      <p className="center small" style={{ margin: "0.3rem 0 0.5rem", minHeight: "1.3em" }}>
        {g.over ? <b>Game over</b> : !myTurn ? "The computer's thinking…" : last ? <>{last.who === 1 ? "The computer" : "You"} {last.words.length ? <>played <b>{last.words.map((w) => w.toUpperCase()).join(", ")}</b> for {last.points}</> : "passed"}</> : "You go first."}
      </p>
      <div className="cl-board" role="grid" aria-label="Board">
        {g.board.map((l, i) => {
          const mine = placed.find((p) => p.at === i), letter = l || (mine ? rack[mine.k] : ""), pr = PREMIUM[i];
          return (
            <button key={i} className={`cl-sq ${pr ?? ""} ${letter ? "tile" : ""} ${mine ? "new" : ""}`} onClick={() => tapSquare(i)} disabled={!myTurn && !mine}
              aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}: ${letter ? letter.toUpperCase() : pr ? LABEL[pr] : i === CENTRE ? "centre" : "empty"}`}>
              {letter ? <><span className="cl-l">{letter.toUpperCase()}</span><span className="cl-v">{VALUE[letter]}</span></> : i === CENTRE ? "★" : pr ? <span className="cl-p">{LABEL[pr]}</span> : null}
            </button>
          );
        })}
      </div>
      <div className="cl-rack" role="group" aria-label="Your tiles">
        {inRack.map((k) => (
          <button key={k} className={`cl-tile ${sel === k && !swapping ? "on" : ""} ${swapping?.includes(k) ? "swap" : ""}`} disabled={!myTurn}
            onClick={() => swapping ? setSwapping(swapping.includes(k) ? swapping.filter((x) => x !== k) : [...swapping, k]) : setSel(k)} aria-pressed={sel === k}>
            <span className="cl-l">{rack[k].toUpperCase()}</span><span className="cl-v">{VALUE[rack[k]]}</span>
          </button>
        ))}
      </div>
      {myTurn && !swapping && (
        <div className="row" style={{ justifyContent: "center", gap: "0.4rem", flexWrap: "wrap" }}>
          <button className="btn btn-pink btn-sm" onClick={submit} disabled={!placed.length}>Play{preview?.ok ? ` ${preview.points}` : ""}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setPlaced([]); setSel(inRack[0] ?? 0); }} disabled={!placed.length}>Take back</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setOrder(shuffled(order, Math.random))}>Shuffle</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setPlaced([]); setSwapping([]); }} disabled={g.bag.length < 7}>Swap</button>
          <button className="btn btn-ghost btn-sm" onClick={() => reset(passOrSwap(g, [], Math.random))}>Pass</button>
        </div>
      )}
      {swapping && (
        <div className="row" style={{ justifyContent: "center", gap: "0.4rem" }}>
          <span className="small">Tap the tiles to swap.</span>
          <button className="btn btn-pink btn-sm" disabled={!swapping.length} onClick={() => reset(passOrSwap(g, swapping.map((k) => rack[k]), Math.random))}>Swap {swapping.length}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSwapping(null)}>Cancel</button>
        </div>
      )}
      {preview && !preview.ok && <p className="center tiny muted">{preview.why}</p>}
      {g.over && <p className="center"><button className="btn btn-pink btn-sm" onClick={() => newMatch()}>Play again</button></p>}
      <p className="small muted" style={{ marginTop: "1rem" }}>On {level}: won {stats[level].won} · lost {stats[level].lost} · best score {stats[level].best}</p>
      <p className="tiny muted">Tap a tile, then a square. Tap a tile you&apos;ve just put down to pick it back up. The computer only plays everyday words, but it&apos;ll accept yours from a much bigger list. Swapping or passing four times in a row between you ends the game.</p>
    </div>
  );
}
