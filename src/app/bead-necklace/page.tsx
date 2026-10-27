"use client";
import "./page.css";
import { Ghost } from "@/components/GameExtras";
import { useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import ArchiveNote from "@/components/ArchiveNote";
import { DoneCard, TodayBoard, useDaily } from "@/components/DailyDone";
import { isPast } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { ACROSS, HINT_MS, LINKS, N, isSolved, linksOf, necklaceFor } from "@/lib/masyu";
import { addFlag } from "@/lib/trophyFlags";

/** Where a link sits, from one square's middle to the next */
function ends(e: number) {
  if (e < ACROSS) { const r = Math.floor(e / (N - 1)), c = e % (N - 1); return { x1: c + 0.5, y1: r + 0.5, x2: c + 1.5, y2: r + 0.5, label: `Row ${r + 1}, between columns ${c + 1} and ${c + 2}` }; }
  const k = e - ACROSS, r = Math.floor(k / N), c = k % N;
  return { x1: c + 0.5, y1: r + 0.5, x2: c + 0.5, y2: r + 1.5, label: `Column ${c + 1}, between rows ${r + 1} and ${r + 2}` };
}

export default function BeadNecklace() {
  const { toast } = useStore();
  const d = useDaily<number[]>("necklace", "mm-necklace", () => Array(LINKS).fill(0));
  const [history, setHistory] = useState<number[][]>([]);
  const [hinted, setHinted] = useState<number | null>(null);
  const puzzle = useMemo(() => (d.date ? necklaceFor(d.date) : null), [d.date]);
  const answer = useMemo(() => (puzzle ? linksOf(puzzle.region) : null), [puzzle]);
  if (!puzzle || !answer || !d.state) return <div className="page"><p className="muted">Stringing the beads…</p></div>;
  const links = d.state, { beads } = puzzle, done = d.doneMs !== null, past = isPast(d.date);

  function put(next: number[], usedHint = false) {
    const t = d.tick();
    setHistory([...history, links]); d.setState(next);
    if (isSolved(beads, next.map((x) => x === 1))) {
      const h = d.hints + (usedHint ? 1 : 0);
      d.setDoneMs(Date.now() - t + h * HINT_MS);
      if (!h) addFlag("necklace-no-hints");
      toast("The necklace is strung! 📿🎉");
    }
  }
  function tap(e: number) {
    if (done) return;
    const next = [...links]; next[e] = (next[e] + 1) % 3;
    setHinted(null); put(next);
  }
  function hint() {
    const wrong = links.findIndex((x, e) => (x === 1 && !answer![e]) || (x === 2 && answer![e]));
    const e = wrong >= 0 ? wrong : answer!.findIndex((on, k) => on && links[k] !== 1);
    if (e < 0) return;
    const next = [...links]; next[e] = answer![e] ? 1 : 0;
    d.setHints(d.hints + 1); setHinted(e); put(next, true);
  }
  return (
    <div className="page" style={{ maxWidth: "32rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={d.date} path="/bead-necklace" />
      <h1 className="h2">Bead <em>necklace</em></h1>
      <p className="small muted">Draw one closed loop through the middles of the squares (across and down only, never crossing itself) that threads every bead. On a white bead the loop goes straight through, and turns in the square before or after. On a black bead the loop turns, and goes straight on through the next square both ways. Tap a gap once to link it, twice to cross it off. There&apos;s only one answer.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={hint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { const p = history[history.length - 1]; if (p) { d.setState(p); setHistory(history.slice(0, -1)); setHinted(null); } }} disabled={!history.length || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setHistory([...history, links]); d.setState(Array(LINKS).fill(0)); setHinted(null); }} disabled={done || links.every((x) => !x)}>Start over</button>
      </div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span className="mm-clock">⏱ {clock(d.elapsed + d.hints * HINT_MS)}</span></div>
      <Ghost elapsed={d.elapsed} done={d.doneMs !== null} />
      <div className={`qr-board bn-board ${done ? "done" : ""}`}>
        <svg viewBox={`0 0 ${N} ${N}`} role="group" aria-label="Bead necklace board">
          {[...Array(N * N).keys()].map((i) => <rect key={`s${i}`} x={(i % N) + 0.03} y={Math.floor(i / N) + 0.03} width={0.94} height={0.94} rx={0.12} className="bn-sq" />)}
          {[...Array(LINKS).keys()].map((e) => {
            const p = ends(e), v = links[e];
            return (
              <g key={e} className={`qr-edge ${v === 1 ? "on" : v === 2 ? "x" : ""} ${hinted === e ? "hint" : ""}`} role="button" tabIndex={done ? -1 : 0}
                aria-label={`${p.label}: ${v === 1 ? "linked" : v === 2 ? "crossed off" : "empty"}`} onClick={() => tap(e)} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); tap(e); } }}>
                <line className="qr-hit" x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} />
                <line className="qr-ink" x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} />
                {v === 2 && <text x={(p.x1 + p.x2) / 2} y={(p.y1 + p.y2) / 2 + 0.04} className="qr-x" textAnchor="middle" dominantBaseline="middle">×</text>}
              </g>
            );
          })}
          {beads.map((b, i) => b ? <circle key={`b${i}`} cx={(i % N) + 0.5} cy={Math.floor(i / N) + 0.5} r={0.24} className={`bn-bead ${b === 1 ? "white" : "black"}`} /> : null)}
        </svg>
      </div>
      <p className="tiny muted center">⚪ white: straight through, with a turn next door · ⚫ black: a turn, with straight runs on both sides.</p>
      {done && <DoneCard replay={d.replay} game="necklace" title="Bead necklace" date={d.date} past={past} headline={`Strung in ${clock(d.doneMs ?? 0)}${d.hints ? ` (${d.hints} hint${d.hints === 1 ? "" : "s"})` : ", no hints"} 🎉`} score={d.doneMs!} saved={d.saved} onSaved={(b) => { d.setBoard(b); d.setSaved(true); }} />}
      {!past && <TodayBoard board={d.board} show={clock} />}
    </div>
  );
}
