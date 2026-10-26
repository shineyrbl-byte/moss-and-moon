"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import ArchiveNote from "@/components/ArchiveNote";
import { DoneCard, TodayBoard, useDaily } from "@/components/DailyDone";
import { isPast } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { HINT_MS, N, gardenFor, isSolved, nextMark, problems, type Mark } from "@/lib/nurikabe";
import { addFlag } from "@/lib/trophyFlags";

export default function GardenPlots() {
  const { toast } = useStore();
  const d = useDaily<Mark[]>("garden", "mm-garden", () => Array(N * N).fill(0));
  const [history, setHistory] = useState<Mark[][]>([]);
  const [hinted, setHinted] = useState<number | null>(null);
  const puzzle = useMemo(() => (d.date ? gardenFor(d.date) : null), [d.date]);
  if (!puzzle || !d.state) return <div className="page"><p className="muted">Digging the beds…</p></div>;
  const marks = d.state, { clues, path } = puzzle, done = d.doneMs !== null, past = isPast(d.date);
  const bad = problems(clues, marks);

  function put(next: Mark[], usedHint = false) {
    const t = d.tick();
    setHistory([...history, marks]); d.setState(next);
    if (isSolved(clues, next)) {
      const h = d.hints + (usedHint ? 1 : 0);
      d.setDoneMs(Date.now() - t + h * HINT_MS);
      if (!h) addFlag("garden-no-hints");
      toast("The garden's laid out! 🌷🎉");
    }
  }
  function tap(i: number) {
    if (done || clues[i]) return;
    const next = [...marks]; next[i] = nextMark(next[i]);
    setHinted(null); put(next);
  }
  function hint() {
    // Fix a wrong mark, or else fill in the next square
    const want = (i: number): Mark => (path[i] ? 1 : 2);
    const i = marks.findIndex((m, k) => m !== 0 && !clues[k] && m !== want(k));
    const j = i >= 0 ? i : marks.findIndex((m, k) => m === 0 && !clues[k] && path[k]);
    const at = j >= 0 ? j : marks.findIndex((m, k) => m === 0 && !clues[k]);
    if (at < 0) return;
    const next = [...marks]; next[at] = want(at);
    d.setHints(d.hints + 1); setHinted(at); put(next, true);
  }
  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={d.date} path="/garden-plots" />
      <h1 className="h2">Garden <em>plots</em></h1>
      <p className="small muted">Shade squares to lay the garden path. Each number is a flower bed of that many unshaded squares, with one number per bed, and beds never touch side by side. The path is all one piece, with no 2×2 block of path anywhere. Tap once for path, twice to mark a flower bed. There&apos;s only one answer.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={hint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { const p = history[history.length - 1]; if (p) { d.setState(p); setHistory(history.slice(0, -1)); setHinted(null); } }} disabled={!history.length || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setHistory([...history, marks]); d.setState(Array(N * N).fill(0)); setHinted(null); }} disabled={done || marks.every((m) => !m)}>Start over</button>
      </div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>⏱ {clock(d.elapsed + d.hints * HINT_MS)}</span></div>
      <div className={`gp-grid ${done ? "done" : ""}`} style={{ ["--n" as string]: N }} role="grid" aria-label="Garden">
        {clues.map((v, i) => (
          <button key={i} className={`gp-cell ${v ? "clue" : marks[i] === 1 ? "path" : marks[i] === 2 ? "bed" : ""} ${bad.has(i) ? "bad" : ""} ${hinted === i ? "hint" : ""}`} onClick={() => tap(i)} disabled={done || !!v}
            aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}: ${v ? `bed of ${v}` : marks[i] === 1 ? "path" : marks[i] === 2 ? "flower bed" : "empty"}${bad.has(i) ? ", breaks a rule" : ""}`}>
            {v ? v : marks[i] === 2 ? <span aria-hidden="true">🌼</span> : null}
          </button>
        ))}
      </div>
      <p className="tiny muted center">A 2×2 block of path turns red.</p>
      {done && <DoneCard game="garden" title="Garden plots" date={d.date} past={past} headline={`Planted in ${clock(d.doneMs ?? 0)}${d.hints ? ` (${d.hints} hint${d.hints === 1 ? "" : "s"})` : ", no hints"} 🎉`} score={d.doneMs!} saved={d.saved} onSaved={(b) => { d.setBoard(b); d.setSaved(true); }} />}
      {!past && <TodayBoard board={d.board} show={clock} />}
    </div>
  );
}
