"use client";
import "./page.css";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { N, SHIP_NAMES, aim, allSunk, fire, newBoard, shipAt, sunk, type Board, type Level } from "@/lib/battleship";
import { addFlag } from "@/lib/trophyFlags";

const STATS = "mm-battleship";

export default function Battleship() {
  const { toast } = useStore();
  const [level, setLevel] = useState<Level>("easy");
  const [mine, setMine] = useState<Board | null>(null);
  const [theirs, setTheirs] = useState<Board | null>(null);
  const [turn, setTurn] = useState<"placing" | "you" | "them" | "over">("placing");
  const [stats, setStats] = useState<Record<Level, { won: number; lost: number }>>({ easy: { won: 0, lost: 0 }, hard: { won: 0, lost: 0 } });
  const [last, setLast] = useState<{ them: number | null; you: number | null }>({ them: null, you: null });
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (v) setStats({ easy: { won: 0, lost: 0 }, hard: { won: 0, lost: 0 }, ...v }); } catch {} setMine(newBoard(Math.random)); setTheirs(newBoard(Math.random)); }, []);
  function record(won: boolean) {
    if (won) addFlag(level === "hard" ? "battleship-hard" : "battleship-win");
    const next = { ...stats, [level]: { won: stats[level].won + (won ? 1 : 0), lost: stats[level].lost + (won ? 0 : 1) } };
    setStats(next); try { localStorage.setItem(STATS, JSON.stringify(next)); } catch {}
  }
  useEffect(() => {
    if (turn !== "them" || !mine) return;
    const id = setTimeout(() => {
      const i = aim(mine, level, Math.random), r = fire(mine, i)!;
      setMine(r.b); setLast((l) => ({ ...l, them: i }));
      if (r.sank !== null) toast(`They sank your ${SHIP_NAMES[r.sank].toLowerCase()}!`);
      if (allSunk(r.b)) { setTurn("over"); record(false); toast("Your whole fleet's gone."); return; }
      setTurn(r.hit ? "them" : "you");
    }, 650);
    return () => clearTimeout(id);
  }, [turn, mine]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!mine || !theirs) return <div className="page"><p className="muted">Hiding the fleet…</p></div>;
  function shoot(i: number) {
    if (turn !== "you" || !theirs) return;
    const r = fire(theirs, i);
    if (!r) return;
    setTheirs(r.b); setLast((l) => ({ ...l, you: i }));
    if (r.sank !== null) toast(`You sank their ${SHIP_NAMES[r.sank].toLowerCase()}! 💥`);
    if (allSunk(r.b)) { setTurn("over"); record(true); toast("You sank the lot! ⚓🎉"); return; }
    if (!r.hit) setTurn("them");
  }
  function restart(lv = level) {
    if (turn === "you" || turn === "them") record(false);
    setLevel(lv); setMine(newBoard(Math.random)); setTheirs(newBoard(Math.random)); setTurn("placing"); setLast({ them: null, you: null });
  }
  const won = turn === "over" && allSunk(theirs);
  const grid = (b: Board, enemy: boolean) => (
    <div className="bs-grid" style={{ ["--n" as string]: N }} role="grid" aria-label={enemy ? "Their sea" : "Your sea"}>
      {[...Array(N * N).keys()].map((i) => {
        const k = shipAt(b, i), shot = b.shots[i], showShip = !enemy || turn === "over";
        const cls = shot ? (k >= 0 ? (sunk(b, k) ? "sunk" : "hit") : "miss") : k >= 0 && showShip ? "ship" : "";
        return (
          <button key={i} className={`bs-sq ${cls} ${(enemy ? last.you : last.them) === i ? "last" : ""}`} disabled={!enemy || shot || turn !== "you"} onClick={() => shoot(i)}
            aria-label={`${"ABCDEFGHIJ"[i % N]}${Math.floor(i / N) + 1}: ${shot ? (k >= 0 ? (sunk(b, k) ? "sunk" : "hit") : "miss") : k >= 0 && showShip ? "your ship" : "sea"}`}>
            {shot ? (k >= 0 ? "💥" : "·") : ""}
          </button>
        );
      })}
    </div>
  );
  const sunkCount = (b: Board) => b.ships.filter((_, k) => sunk(b, k)).length;
  return (
    <div className="page" style={{ maxWidth: "44rem" }}>
      <p className="eyebrow">a game</p>
      <h1 className="h2">Battle<em>ship</em></h1>
      <p className="small muted">You and the computer each hide five craft on a 10×10 sea: an espresso machine (5), a coffee cart (4), a delivery van and a tuk-tuk (3 each) and a bicycle (2). Take turns firing; hit something and you fire again. Sink the whole fleet to win.</p>
      <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
        {(["easy", "hard"] as const).map((lv) => <button key={lv} className={`chip ${level === lv ? "on" : ""}`} onClick={() => lv !== level && restart(lv)}>{lv === "easy" ? "Easy" : "Hard"}</button>)}
        <button className="btn btn-ghost btn-sm" onClick={() => restart()}>New game</button>
      </div>
      {turn === "placing" && (
        <div className="row" style={{ gap: "0.5rem", margin: "0.8rem 0", flexWrap: "wrap" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setMine(newBoard(Math.random))}>🔀 Move my fleet</button>
          <button className="btn btn-pink btn-sm" onClick={() => setTurn("you")}>Start firing</button>
        </div>
      )}
      <p className="center small" aria-live="polite"><b>{turn === "placing" ? "Happy with where your fleet is?" : turn === "you" ? "Your shot: pick a square on their sea" : turn === "them" ? "They're aiming…" : won ? "You win! ⚓🎉" : "The computer wins"}</b></p>
      <div className="bs-seas">
        <section><h2 className="h3">Their sea <span className="small muted">· {sunkCount(theirs)}/5 sunk</span></h2>{grid(theirs, true)}</section>
        <section><h2 className="h3">Your sea <span className="small muted">· {sunkCount(mine)}/5 sunk</span></h2>{grid(mine, false)}</section>
      </div>
      <p className="small muted" style={{ marginTop: "0.8rem" }}>On {level}: won {stats[level].won} · lost {stats[level].lost}. Hard hunts in a pattern and follows up its hits.</p>
    </div>
  );
}
