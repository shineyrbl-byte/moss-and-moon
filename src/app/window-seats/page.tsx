"use client";
import "./page.css";
import { Ghost } from "@/components/GameExtras";
import { useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import ArchiveNote from "@/components/ArchiveNote";
import { DoneCard, TodayBoard, useDaily } from "@/components/DailyDone";
import { isPast } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { HINT_MS, N, isSolved, litSquares, nextMark, problems, seatsFor, type Mark } from "@/lib/akari";
import { addFlag } from "@/lib/trophyFlags";

export default function WindowSeats() {
  const { toast } = useStore();
  const d = useDaily<Mark[]>("seats", "mm-seats", () => Array(N * N).fill(0));
  const [history, setHistory] = useState<Mark[][]>([]);
  const [hinted, setHinted] = useState<number | null>(null);
  const puzzle = useMemo(() => (d.date ? seatsFor(d.date) : null), [d.date]);
  if (!puzzle || !d.state) return <div className="page"><p className="muted">Wiring up the lamps…</p></div>;
  const marks = d.state, { walls, lamps } = puzzle, done = d.doneMs !== null, past = isPast(d.date);
  const bad = problems(walls, marks), lit = litSquares(walls, marks);

  function put(next: Mark[], usedHint = false) {
    const t = d.tick();
    setHistory([...history, marks]); d.setState(next);
    if (isSolved(walls, next)) {
      const h = d.hints + (usedHint ? 1 : 0);
      d.setDoneMs(Date.now() - t + h * HINT_MS);
      if (!h) addFlag("seats-no-hints");
      toast("Every seat's in the light! 💡🎉");
    }
  }
  function tap(i: number) {
    if (done || walls[i] !== null) return;
    const next = [...marks]; next[i] = nextMark(next[i]);
    setHinted(null); put(next);
  }
  function hint() {
    const wrong = marks.findIndex((m, i) => m === 2 && !lamps.includes(i));
    const next = [...marks];
    let at: number;
    if (wrong >= 0) { next[wrong] = 0; at = wrong; }
    else { at = lamps.find((i) => marks[i] !== 2)!; if (at === undefined) return; next[at] = 2; }
    d.setHints(d.hints + 1); setHinted(at); put(next, true);
  }
  const open = walls.filter((w) => w === null).length;
  return (
    <div className="page" style={{ maxWidth: "32rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={d.date} path="/window-seats" />
      <h1 className="h2">Window <em>seats</em></h1>
      <p className="small muted">Put lamps in the café so every open square is lit. A lamp lights its whole row and column until a wall gets in the way. No lamp may shine on another lamp, and a numbered wall has exactly that many lamps right next to it (above, below, left or right). Tap once for a lamp, twice to cross a square off. There&apos;s only one answer.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={hint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { const p = history[history.length - 1]; if (p) { d.setState(p); setHistory(history.slice(0, -1)); setHinted(null); } }} disabled={!history.length || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setHistory([...history, marks]); d.setState(Array(N * N).fill(0)); setHinted(null); }} disabled={done || marks.every((m) => !m)}>Start over</button>
      </div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>💡 <b>{lit.size}</b>/{open} lit</span><span className="mm-clock">⏱ {clock(d.elapsed + d.hints * HINT_MS)}</span></div>
      <Ghost elapsed={d.elapsed} done={d.doneMs !== null} />
      <div className={`ws-grid ${done ? "done" : ""}`} style={{ ["--n" as string]: N }} role="grid" aria-label="Café floor">
        {walls.map((w, i) => w !== null ? (
          <span key={i} className={`ws-wall ${bad.walls.has(i) ? "bad" : ""}`} aria-label={w >= 0 ? `Wall, needs ${w} lamp${w === 1 ? "" : "s"}` : "Wall"}>{w >= 0 ? w : ""}</span>
        ) : (
          <button key={i} className={`ws-cell ${lit.has(i) ? "lit" : ""} ${bad.lamps.has(i) ? "bad" : ""} ${hinted === i ? "hint" : ""}`} onClick={() => tap(i)} disabled={done}
            aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}: ${marks[i] === 2 ? "lamp" : marks[i] === 1 ? "crossed off" : "empty"}${lit.has(i) ? ", lit" : ""}`}>
            {marks[i] === 2 ? <span aria-hidden="true">💡</span> : marks[i] === 1 ? <span className="tf-x" aria-hidden="true">✕</span> : null}
          </button>
        ))}
      </div>
      <p className="tiny muted center">Lit squares glow. Lamps that shine on each other, and walls with too many lamps, turn red.</p>
      {done && <DoneCard replay={d.replay} proof={d.state} game="seats" title="Window seats" date={d.date} past={past} headline={`All lit in ${clock(d.doneMs ?? 0)}${d.hints ? ` (${d.hints} hint${d.hints === 1 ? "" : "s"})` : ", no hints"} 🎉`} score={d.doneMs!} saved={d.saved} onSaved={(b) => { d.setBoard(b); d.setSaved(true); }} />}
      {!past && <TodayBoard board={d.board} show={clock} />}
    </div>
  );
}
