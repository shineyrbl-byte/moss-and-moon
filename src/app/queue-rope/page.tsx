"use client";
import "./page.css";
import { Ghost } from "@/components/GameExtras";
import { useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import ArchiveNote from "@/components/ArchiveNote";
import { DoneCard, TodayBoard, useDaily } from "@/components/DailyDone";
import { isPast } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { EDGES, HINT_MS, H_COUNT, N, badClues, isSolved, loopOf, ropeFor } from "@/lib/slitherlink";
import { addFlag } from "@/lib/trophyFlags";

const P = 0.4;
/** Where an edge sits */
function ends(e: number) {
  if (e < H_COUNT) { const r = Math.floor(e / N), c = e % N; return { x1: c, y1: r, x2: c + 1, y2: r, label: `Across line ${r + 1}, gap ${c + 1}` }; }
  const k = e - H_COUNT, r = Math.floor(k / (N + 1)), c = k % (N + 1);
  return { x1: c, y1: r, x2: c, y2: r + 1, label: `Down line ${c + 1}, gap ${r + 1}` };
}

export default function QueueRope() {
  const { toast } = useStore();
  const d = useDaily<number[]>("rope", "mm-rope", () => Array(EDGES).fill(0));
  const [history, setHistory] = useState<number[][]>([]);
  const [hinted, setHinted] = useState<number | null>(null);
  const puzzle = useMemo(() => (d.date ? ropeFor(d.date) : null), [d.date]);
  const answer = useMemo(() => (puzzle ? loopOf(puzzle.inside) : null), [puzzle]);
  if (!puzzle || !answer || !d.state) return <div className="page"><p className="muted">Uncoiling the rope…</p></div>;
  const edges = d.state, { clues } = puzzle, done = d.doneMs !== null, past = isPast(d.date);
  const bad = badClues(clues, edges);

  function put(next: number[], usedHint = false) {
    const t = d.tick();
    setHistory([...history, edges]); d.setState(next);
    if (isSolved(clues, next.map((x) => x === 1))) {
      const h = d.hints + (usedHint ? 1 : 0);
      d.setDoneMs(Date.now() - t + h * HINT_MS);
      if (!h) addFlag("rope-no-hints");
      toast("The queue rope's up! 🪢🎉");
    }
  }
  function tap(e: number) {
    if (done) return;
    const next = [...edges]; next[e] = (next[e] + 1) % 3;
    setHinted(null); put(next);
  }
  function hint() {
    const wrong = edges.findIndex((x, e) => (x === 1 && !answer![e]) || (x === 2 && answer![e]));
    const e = wrong >= 0 ? wrong : answer!.findIndex((on, k) => on && edges[k] !== 1);
    if (e < 0) return;
    const next = [...edges]; next[e] = answer![e] ? 1 : 0;
    d.setHints(d.hints + 1); setHinted(e); put(next, true);
  }
  return (
    <div className="page" style={{ maxWidth: "32rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={d.date} path="/queue-rope" />
      <h1 className="h2">Queue <em>rope</em></h1>
      <p className="small muted">Run one rope round the café queue: a single closed loop along the dotted lines, never crossing or touching itself. A number says how many of that square&apos;s four sides the rope runs along. Tap a gap once for rope, twice to cross it off. There&apos;s only one answer.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={hint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { const p = history[history.length - 1]; if (p) { d.setState(p); setHistory(history.slice(0, -1)); setHinted(null); } }} disabled={!history.length || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setHistory([...history, edges]); d.setState(Array(EDGES).fill(0)); setHinted(null); }} disabled={done || edges.every((x) => !x)}>Start over</button>
      </div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>Rope <b>{edges.filter((x) => x === 1).length}</b></span><span className="mm-clock">⏱ {clock(d.elapsed + d.hints * HINT_MS)}</span></div>
      <Ghost elapsed={d.elapsed} done={d.doneMs !== null} />
      <div className={`qr-board ${done ? "done" : ""}`}>
        <svg viewBox={`${-P} ${-P} ${N + 2 * P} ${N + 2 * P}`} role="group" aria-label="Queue rope board">
          {clues.map((k, i) => k !== null && <text key={`c${i}`} x={(i % N) + 0.5} y={Math.floor(i / N) + 0.56} className={`qr-clue ${bad.has(i) ? "bad" : ""}`} textAnchor="middle" dominantBaseline="middle">{k}</text>)}
          {[...Array(EDGES).keys()].map((e) => {
            const p = ends(e), v = edges[e];
            return (
              <g key={e} className={`qr-edge ${v === 1 ? "on" : v === 2 ? "x" : ""} ${hinted === e ? "hint" : ""}`} role="button" tabIndex={done ? -1 : 0}
                aria-label={`${p.label}: ${v === 1 ? "rope" : v === 2 ? "crossed off" : "empty"}`} onClick={() => tap(e)} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); tap(e); } }}>
                <line className="qr-hit" x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} />
                <line className="qr-ink" x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} />
                {v === 2 && <text x={(p.x1 + p.x2) / 2} y={(p.y1 + p.y2) / 2 + 0.04} className="qr-x" textAnchor="middle" dominantBaseline="middle">×</text>}
              </g>
            );
          })}
          {[...Array((N + 1) * (N + 1)).keys()].map((k) => <circle key={`d${k}`} cx={k % (N + 1)} cy={Math.floor(k / (N + 1))} r={0.06} className="qr-dot" />)}
        </svg>
      </div>
      <p className="tiny muted center">Numbers with too much rope round them (or not enough room left) turn red.</p>
      {done && <DoneCard replay={d.replay} game="rope" title="Queue rope" date={d.date} past={past} headline={`Roped off in ${clock(d.doneMs ?? 0)}${d.hints ? ` (${d.hints} hint${d.hints === 1 ? "" : "s"})` : ", no hints"} 🎉`} score={d.doneMs!} saved={d.saved} onSaved={(b) => { d.setBoard(b); d.setSaved(true); }} />}
      {!past && <TodayBoard board={d.board} show={clock} />}
    </div>
  );
}
