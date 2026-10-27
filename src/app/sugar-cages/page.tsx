"use client";
import "./page.css";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import ArchiveNote from "@/components/ArchiveNote";
import { DoneCard, TodayBoard, useDaily } from "@/components/DailyDone";
import { Ghost } from "@/components/GameExtras";
import { isPast } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { HINT_MS, N, cagesFor, clashes, isSolved } from "@/lib/killerSudoku";
import { addFlag } from "@/lib/trophyFlags";

export default function SugarCages() {
  const { toast } = useStore();
  const d = useDaily<number[]>("cages", "mm-cages", () => Array(N * N).fill(0));
  const [at, setAt] = useState<number | null>(null);
  const p = useMemo(() => (d.date ? cagesFor(d.date) : null), [d.date]);
  const cells = d.state && p ? d.state.map((v, i) => p.given[i] || v) : [];
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || at === null) return;
      const k = Number(e.key);
      if (k >= 1 && k <= 6) { e.preventDefault(); put(k); } else if (e.key === "Backspace" || e.key === "0") { e.preventDefault(); put(0); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  if (!p || !d.state) return <div className="page"><p className="muted">Building the cages…</p></div>;
  const done = d.doneMs !== null, past = isPast(d.date), bad = clashes(p.cages, cells);
  const cageOf = Array(N * N).fill(0); p.cages.forEach((c, k) => c.cells.forEach((i) => (cageOf[i] = k)));
  // The cage total goes in its top-left square
  const label = new Map(p.cages.map((c) => [Math.min(...c.cells), c.sum]));
  function put(v: number, usedHint = false) {
    if (at === null || done || p!.given[at]) return;
    const t = d.tick();
    const next = d.state!.map((x, i) => (i === at ? v : x));
    d.setState(next);
    const full = next.map((x, i) => p!.given[i] || x);
    if (isSolved(p!.answer, full)) {
      const h = d.hints + (usedHint ? 1 : 0);
      d.setDoneMs(Date.now() - t + h * HINT_MS);
      if (!h) addFlag("cages-no-hints");
      toast("Every cage adds up! 🍬🎉");
    }
  }
  function hint() {
    const wrong = cells.findIndex((v, i) => v && v !== p!.answer[i]);
    const i = wrong >= 0 ? wrong : cells.findIndex((v) => !v);
    if (i < 0) return;
    setAt(i); d.setHints(d.hints + 1);
    const t = d.tick(), next = d.state!.map((x, k) => (k === i ? p!.answer[i] : x)), h = d.hints + 1;
    d.setState(next);
    if (isSolved(p!.answer, next.map((x, k) => p!.given[k] || x))) d.setDoneMs(Date.now() - t + h * HINT_MS);
  }
  const edge = (i: number) => {
    const c = cageOf[i], r = Math.floor(i / N), col = i % N;
    return `${r === 0 || cageOf[i - N] !== c ? "ct" : ""} ${r === N - 1 || cageOf[i + N] !== c ? "cb" : ""} ${col === 0 || cageOf[i - 1] !== c ? "cl" : ""} ${col === N - 1 || cageOf[i + 1] !== c ? "cr" : ""}`;
  };
  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={d.date} path="/sugar-cages" />
      <h1 className="h2">Sugar <em>cages</em></h1>
      <p className="small muted">A killer sudoku. Fill the grid with 1 to 6 so every row, column and 2×3 box has each number once. The dotted cages show what their numbers add up to, and a number can&apos;t repeat inside a cage. There&apos;s only one answer.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={hint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
        <span className="memory-stats"><span className="mm-clock">⏱ {clock(d.elapsed + d.hints * HINT_MS)}</span></span>
      </div>
      <Ghost elapsed={d.elapsed} done={done} />
      <div className={`kc-grid ${done ? "done" : ""}`} role="group" data-grid="" aria-label="Sugar cages">
        {cells.map((v, i) => (
          <button key={i} className={`kc-cell ${edge(i)} ${p.given[i] ? "given" : ""} ${at === i ? "at" : ""} ${bad.has(i) ? "bad" : ""} ${i % N === 2 ? "box-r" : ""} ${Math.floor(i / N) % 2 === 1 && i < N * (N - 1) ? "box-b" : ""}`} onClick={() => setAt(i)}
            aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}: ${v || "empty"}, cage of ${p.cages[cageOf[i]].cells.length} adding to ${p.cages[cageOf[i]].sum}`}>
            {label.has(i) && <span className="kc-sum" aria-hidden="true">{label.get(i)}</span>}
            <span aria-hidden="true">{v || ""}</span>
          </button>
        ))}
      </div>
      {!done && <div className="kc-pad" role="group" aria-label="Numbers">{[1, 2, 3, 4, 5, 6].map((v) => <button key={v} className="kc-key" onClick={() => put(v)} disabled={at === null || !!p.given[at]}>{v}</button>)}<button className="kc-key" onClick={() => put(0)} disabled={at === null} aria-label="Clear">⌫</button></div>}
      {done && <DoneCard replay={d.replay} game="cages" title="Sugar cages" date={d.date} past={past} headline={`Caged in ${clock(d.doneMs ?? 0)}${d.hints ? ` (${d.hints} hint${d.hints === 1 ? "" : "s"})` : ", no hints"} 🎉`} score={d.doneMs!} proof={cells} saved={d.saved} onSaved={(b) => { d.setBoard(b); d.setSaved(true); }} />}
      {!past && <TodayBoard board={d.board} show={clock} />}
    </div>
  );
}
