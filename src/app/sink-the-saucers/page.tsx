"use client";
import "./page.css";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { FLEET, SIZE, aiShot, allSunk, isSunk, placeFleet, shipAt, shoot, type Ship } from "@/lib/saucers";

type Level = "easy" | "hard";
type Rec = { won: number; lost: number };
const STATS = "mm-saucers";
const empty = (): Record<Level, Rec> => ({ easy: { won: 0, lost: 0 }, hard: { won: 0, lost: 0 } });
const cellName = (c: number) => `${"ABCDEFGH"[c % SIZE]}${Math.floor(c / SIZE) + 1}`;

function Grid({ ships, shots, show, onShoot, label, last }: { ships: Ship[]; shots: number[]; show: boolean; onShoot?: (c: number) => void; label: string; last: number | null }) {
  return (
    <div className="ss-grid" role="grid" aria-label={label}>
      {[...Array(SIZE * SIZE).keys()].map((c) => {
        const k = shipAt(ships, c), shot = shots.includes(c), sunk = k >= 0 && isSunk(ships[k], shots);
        const state = shot ? (k >= 0 ? (sunk ? "sunk" : "hit") : "miss") : "";
        const visible = k >= 0 && (show || sunk);
        return (
          <button key={c} className={`ss-cell ${state} ${visible ? "ship" : ""} ${last === c ? "last" : ""}`} disabled={!onShoot || shot} onClick={() => onShoot?.(c)}
            aria-label={`${cellName(c)}: ${state || (visible ? FLEET[k].name : "not tried")}`}>
            {state === "miss" ? "·" : state ? "💥" : visible ? FLEET[k].emoji : ""}
          </button>
        );
      })}
    </div>
  );
}

export default function SinkTheSaucers() {
  const { toast } = useStore();
  const [level, setLevel] = useState<Level>("easy");
  const [mine, setMine] = useState<Ship[]>([]);
  const [theirs, setTheirs] = useState<Ship[]>([]);
  const [myShots, setMyShots] = useState<number[]>([]);
  const [aiShots, setAiShots] = useState<number[]>([]);
  const [phase, setPhase] = useState<"setup" | "you" | "ai" | "won" | "lost">("setup");
  const [note, setNote] = useState("");
  const [stats, setStats] = useState(empty());
  useEffect(() => {
    setMine(placeFleet()); setTheirs(placeFleet());
    try { const v = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (v) { setStats({ ...empty(), ...v.stats }); if (v.level === "hard") setLevel("hard"); } } catch {}
  }, []);
  function saveStats(next: Record<Level, Rec>, lv = level) { setStats(next); try { localStorage.setItem(STATS, JSON.stringify({ stats: next, level: lv })); } catch {} }
  function finish(r: "won" | "lost") {
    setPhase(r);
    saveStats({ ...stats, [level]: { ...stats[level], [r]: stats[level][r] + 1 } });
    toast(r === "won" ? "Every saucer sunk! You win 🎉" : "The computer found all your tableware.");
  }
  function fire(c: number) {
    if (phase !== "you") return;
    const res = shoot(theirs, myShots, c), shots = [...myShots, c];
    setMyShots(shots);
    const k = shipAt(theirs, c);
    setNote(res === "miss" ? `You fired at ${cellName(c)}: a miss.` : res === "hit" ? `You fired at ${cellName(c)}: a hit!` : `You sank their ${FLEET[k].name.toLowerCase()}! ${FLEET[k].emoji}`);
    if (allSunk(theirs, shots)) return finish("won");
    setPhase("ai");
  }
  useEffect(() => {
    if (phase !== "ai") return;
    const id = setTimeout(() => {
      const c = aiShot(mine, aiShots, level), res = shoot(mine, aiShots, c), shots = [...aiShots, c];
      setAiShots(shots);
      const k = shipAt(mine, c);
      setNote((n) => `${n} The computer fired at ${cellName(c)}${res === "miss" ? " and missed." : res === "hit" ? " and hit!" : ` and sank your ${FLEET[k].name.toLowerCase()}.`}`);
      if (allSunk(mine, shots)) finish("lost"); else setPhase("you");
    }, 650);
    return () => clearTimeout(id);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  function reset(lv = level) {
    // Leaving a game halfway counts as a loss
    if ((phase === "you" || phase === "ai") && myShots.length) saveStats({ ...stats, [level]: { ...stats[level], lost: stats[level].lost + 1 } }, lv);
    else if (lv !== level) saveStats(stats, lv);
    setLevel(lv); setMine(placeFleet()); setTheirs(placeFleet()); setMyShots([]); setAiShots([]); setPhase("setup"); setNote("");
  }
  if (!mine.length) return <div className="page"><p className="muted">Laying the tables…</p></div>;
  const playing = phase === "you" || phase === "ai";
  const over = phase === "won" || phase === "lost";
  const rec = stats[level];
  const fleetList = (ships: Ship[], shots: number[]) => (
    <ul className="ss-fleet">{FLEET.map((f, i) => <li key={i} className={isSunk(ships[i], shots) ? "sunk" : ""}>{f.emoji} {f.name} <span className="tiny muted">({f.len})</span></li>)}</ul>
  );
  return (
    <div className="page" style={{ maxWidth: "48rem" }}>
      <p className="eyebrow">a board game</p>
      <h1 className="h2">Sink the <em>saucers</em></h1>
      <p className="small muted">You and the computer each hide five pieces of tableware on a grid. Take turns firing at each other&apos;s table: 💥 is a hit, · is a miss. Sink all five of theirs before they sink yours. Pieces never touch, not even corner to corner.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {(["easy", "hard"] as const).map((lv) => <button key={lv} className={`chip ${level === lv ? "on" : ""}`} aria-pressed={level === lv} onClick={() => lv !== level && reset(lv)}>{lv === "easy" ? "Easy" : "Hard"}</button>)}
        {phase === "setup" && <><button className="btn btn-ghost btn-sm" onClick={() => setMine(placeFleet())}>🔀 Rearrange my table</button><button className="btn btn-pink btn-sm" onClick={() => { setPhase("you"); setNote("Your go. Tap a square on their table."); }}>Start firing</button></>}
        {(playing || over) && <button className="btn btn-ghost btn-sm" onClick={() => reset()}>New game</button>}
      </div>
      <p className="small center" aria-live="polite" style={{ minHeight: "2.6em" }}>
        {phase === "setup" ? "Happy with where your tableware is? Rearrange it as often as you like, then start." : phase === "won" ? <b>You sank everything in {myShots.length} shots! 🎉</b> : phase === "lost" ? <b>The computer wins, in {aiShots.length} shots.</b> : note}
      </p>
      <div className="ss-boards">
        <section>
          <h2 className="h3">Their table {phase === "you" && <span className="tiny muted">· your shot</span>}</h2>
          <Grid ships={theirs} shots={myShots} show={over} onShoot={phase === "you" ? fire : undefined} label="The computer's table" last={myShots[myShots.length - 1] ?? null} />
          {fleetList(theirs, myShots)}
        </section>
        <section>
          <h2 className="h3">Your table {phase === "ai" && <span className="tiny muted">· they&apos;re aiming…</span>}</h2>
          <Grid ships={mine} shots={aiShots} show label="Your table" last={aiShots[aiShots.length - 1] ?? null} />
          {fleetList(mine, aiShots)}
        </section>
      </div>
      <p className="small muted" style={{ marginTop: "1rem" }}>On {level}: won {rec.won} · lost {rec.lost}</p>
      <p className="tiny muted">Easy fires at random. Hard works out where your pieces could still be hiding. Your record is kept on this device, and leaving a game halfway counts as a loss.</p>
    </div>
  );
}
