"use client";
import "./page.css";
import { Ghost } from "@/components/GameExtras";
import { useMemo, useRef } from "react";
import { useStore } from "@/components/Store";
import ArchiveNote from "@/components/ArchiveNote";
import { DoneCard, TodayBoard, useDaily } from "@/components/DailyDone";
import { isPast } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { HINT_MS, N, isSolved, touches, validLine, zipFor } from "@/lib/zipPath";
import { addFlag } from "@/lib/trophyFlags";

export default function ZipPath() {
  const { toast } = useStore();
  const d = useDaily<number[]>("zip", "mm-zip", () => []);
  const drawing = useRef(false);
  const p = useMemo(() => (d.date ? zipFor(d.date) : null), [d.date]);
  if (!p || !d.state) return <div className="page"><p className="muted">Laying out the path…</p></div>;
  const line = d.state, done = d.doneMs !== null, past = isPast(d.date), last = Math.max(...p.marks);
  const order = new Map(line.map((c, k) => [c, k]));
  function put(next: number[], usedHint = false) {
    const t = d.tick();
    d.setState(next);
    if (isSolved(p!.marks, next)) {
      const h = d.hints + (usedHint ? 1 : 0);
      d.setDoneMs(Date.now() - t + h * HINT_MS);
      if (!h) addFlag("zip-no-hints");
      toast("One line through every square! 〰️🎉");
    }
  }
  // Touch a square: start at 1, step on from the end of the line, or go back to an earlier square
  function touch(i: number, fromDrag = false) {
    if (done) return;
    if (!line.length) { if (p!.marks[i] === 1) put([i]); else if (!fromDrag) toast("Start on the 1."); return; }
    const k = order.get(i);
    if (k !== undefined) { if (k < line.length - 1) put(line.slice(0, k + 1)); return; }
    if (!touches(line[line.length - 1], i)) { if (!fromDrag) toast("Step to a square next to the end of your line."); return; }
    const next = [...line, i];
    if (!validLine(p!.marks, next)) { if (!fromDrag) toast(p!.marks[i] ? "Pass the numbers in order." : "That doesn't work."); return; }
    put(next);
  }
  function hint() {
    // Keep the part of your line that matches the answer, then add the next square of the answer
    let k = 0;
    while (k < line.length && line[k] === p!.path[k]) k++;
    if (k >= p!.path.length) return;
    d.setHints(d.hints + 1);
    put(p!.path.slice(0, k + 1), true);
  }
  const cellAt = (e: React.PointerEvent) => { const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-i]"); return el ? Number(el.getAttribute("data-i")) : null; };
  // The line, drawn as an SVG polyline through the squares' middles
  const pts = line.map((c) => `${(c % N) + 0.5},${Math.floor(c / N) + 0.5}`).join(" ");
  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={d.date} path="/zip-path" />
      <h1 className="h2">Zip <em>path</em></h1>
      <p className="small muted">Draw one line through every square, going up, down, left or right, never crossing itself. Start on 1 and pass the numbers in order, ending on {last}. Drag, or tap one square after another. Tap a square on your line to go back to it.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={hint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
        <button className="btn btn-ghost btn-sm" onClick={() => d.setState(line.slice(0, -1))} disabled={done || !line.length}>↩ Back one</button>
        <button className="btn btn-ghost btn-sm" onClick={() => d.setState([])} disabled={done || !line.length}>Start over</button>
        <span className="memory-stats"><span><b>{line.length}</b>/{N * N}</span><span className="mm-clock">⏱ {clock(d.elapsed + d.hints * HINT_MS)}</span></span>
      </div>
      <Ghost elapsed={d.elapsed} done={d.doneMs !== null} />
      <div className={`zp-grid ${done ? "done" : ""}`} style={{ ["--n" as string]: N }} role="group" data-grid="" aria-label="Zip path"
        onPointerDown={(e) => { drawing.current = true; const i = cellAt(e); if (i !== null) touch(i); }}
        onPointerMove={(e) => { if (!drawing.current) return; const i = cellAt(e); if (i !== null && i !== line[line.length - 1]) touch(i, true); }}
        onPointerUp={() => { drawing.current = false; }} onPointerLeave={() => { drawing.current = false; }}>
        <svg viewBox={`0 0 ${N} ${N}`} className="zp-line" aria-hidden="true"><polyline points={pts} /></svg>
        {p.marks.map((m, i) => (
          <button key={i} data-i={i} className={`zp-cell ${order.has(i) ? "on" : ""} ${line[line.length - 1] === i ? "end" : ""}`} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); touch(i); } }} onClick={(e) => e.preventDefault()}
            aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}${m ? `, number ${m}` : ""}${order.has(i) ? `, step ${order.get(i)! + 1} of your line` : ""}`}>
            {m ? <span className="zp-num">{m}</span> : null}
          </button>
        ))}
      </div>
      {done && <DoneCard replay={d.replay} proof={d.state} game="zip" title="Zip path" date={d.date} past={past} headline={`Zipped in ${clock(d.doneMs ?? 0)}${d.hints ? ` (${d.hints} hint${d.hints === 1 ? "" : "s"})` : ", no hints"} 🎉`} score={d.doneMs!} saved={d.saved} onSaved={(b) => { d.setBoard(b); d.setSaved(true); }} />}
      {!past && <TodayBoard board={d.board} show={clock} />}
    </div>
  );
}
