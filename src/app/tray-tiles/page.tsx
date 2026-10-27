"use client";
import "./page.css";
import { Ghost } from "@/components/GameExtras";
import { useMemo, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import ArchiveNote from "@/components/ArchiveNote";
import { DoneCard, TodayBoard, useDaily } from "@/components/DailyDone";
import { isPast } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { HINT_MS, N, cellsOf, isSolved, problems, rectFrom, trayTilesFor, type Rect } from "@/lib/shikaku";
import { addFlag } from "@/lib/trophyFlags";

const TINTS = ["#f6c9d4", "#ead6c4", "#cfdcc0", "#f8e2a9", "#dccdea", "#c6dcec", "#f7cfb2", "#bfe3d6"];
const same = (a: Rect, b: Rect) => a.r === b.r && a.c === b.c && a.h === b.h && a.w === b.w;

export default function TrayTiles() {
  const { toast } = useStore();
  const d = useDaily<Rect[]>("traytiles", "mm-traytiles", () => []);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [history, setHistory] = useState<Rect[][]>([]);
  const dragging = useRef<number | null>(null);
  const puzzle = useMemo(() => (d.date ? trayTilesFor(d.date) : null), [d.date]);
  if (!puzzle || !d.state) return <div className="page"><p className="muted">Laying out the tray…</p></div>;
  const rects = d.state, done = d.doneMs !== null, past = isPast(d.date);
  const bad = problems(puzzle.clues, rects);
  const owner = Array(N * N).fill(-1);
  rects.forEach((x, k) => cellsOf(x).forEach((i) => { owner[i] = k; }));

  function place(x: Rect, usedHint = false) {
    const t = d.tick();
    const keep = rects.filter((o) => !cellsOf(o).some((i) => cellsOf(x).includes(i)));
    const next = [...keep, x];
    setHistory([...history, rects]); d.setState(next);
    if (isSolved(puzzle!.clues, next)) {
      const h = d.hints + (usedHint ? 1 : 0);
      d.setDoneMs(Date.now() - t + h * HINT_MS);
      if (!h) addFlag("traytiles-no-hints");
      toast("Every tile fits the tray! 🍱🎉");
    }
  }
  function finish(a: number, b: number) {
    setAnchor(null); setHover(null);
    if (a === b && owner[a] !== -1) { setHistory([...history, rects]); d.setState(rects.filter((_, k) => k !== owner[a])); return; }
    place(rectFrom(a, b));
  }
  function tap(i: number) {
    if (done) return;
    if (anchor === null) { setAnchor(i); return; }
    finish(anchor, i);
  }
  function hint() {
    const right = puzzle!.rects.find((x) => !rects.some((o) => same(o, x)));
    if (!right) return;
    d.setHints(d.hints + 1); place(right, true);
  }
  const from = dragging.current ?? anchor;
  const preview = from !== null && hover !== null ? new Set(cellsOf(rectFrom(from, hover))) : new Set<number>();
  const elapsed = d.elapsed + d.hints * HINT_MS;
  const edge = (i: number) => {
    const r = Math.floor(i / N), c = i % N, me = owner[i];
    if (me === -1) return "";
    return `${r === 0 || owner[i - N] !== me ? "et " : ""}${c === 0 || owner[i - 1] !== me ? "el " : ""}${r === N - 1 || owner[i + N] !== me ? "eb " : ""}${c === N - 1 || owner[i + 1] !== me ? "er" : ""}`;
  };
  return (
    <div className="page" style={{ maxWidth: "32rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={d.date} path="/tray-tiles" />
      <h1 className="h2">Tray <em>tiles</em></h1>
      <p className="small muted">Cut the tray into rectangles. Each rectangle holds exactly one number, and covers that many squares. Drag from corner to corner to draw one (or tap two corners). Tap a rectangle twice to lift it off. There&apos;s only one answer.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={hint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { const p = history[history.length - 1]; if (p) { d.setState(p); setHistory(history.slice(0, -1)); } }} disabled={!history.length || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setHistory([...history, rects]); d.setState([]); }} disabled={done || !rects.length}>Start over</button>
      </div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span><b>{owner.filter((o) => o === -1).length}</b> squares left</span><span className="mm-clock">⏱ {clock(elapsed)}</span></div>
      <Ghost elapsed={d.elapsed} done={d.doneMs !== null} />
      <div className={`tt-grid ${done ? "done" : ""}`} style={{ ["--n" as string]: N }} role="grid" aria-label="Tray"
        onPointerUp={() => {
          // Let go on another square: that's a drag. On the same square: a tap.
          const a = dragging.current; dragging.current = null;
          if (a === null || hover === null) return;
          if (hover !== a) finish(a, hover); else tap(a);
        }}
        onPointerLeave={() => { dragging.current = null; setHover(null); }}>
        {puzzle.clues.map((v, i) => (
          <button key={i} className={`tt-cell ${edge(i)} ${preview.has(i) ? "pre" : ""} ${anchor === i ? "anchor" : ""} ${owner[i] !== -1 && bad.has(owner[i]) ? "bad" : ""}`}
            style={owner[i] !== -1 ? { background: TINTS[owner[i] % TINTS.length] } : undefined} disabled={done}
            onPointerDown={(e) => { (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); if (!done && anchor === null) { dragging.current = i; setHover(i); } else setHover(i); }}
            onPointerEnter={() => setHover(i)}
            onPointerUp={(e) => { if (anchor !== null && dragging.current === null) { e.stopPropagation(); tap(i); } }}
            onClick={(e) => { if (e.detail === 0) tap(i); }}
            aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}${v ? `: ${v}` : ""}${owner[i] !== -1 ? ", in a tile" : ""}${anchor === i ? ", corner picked" : ""}`}>
            {v || ""}
          </button>
        ))}
      </div>
      <p className="tiny muted center">{anchor !== null ? "Now the opposite corner." : "Tiles with no number, two numbers, or the wrong size turn red."}</p>
      {done && <DoneCard replay={d.replay} game="traytiles" title="Tray tiles" date={d.date} past={past} headline={`Tiled in ${clock(d.doneMs ?? 0)}${d.hints ? ` (${d.hints} hint${d.hints === 1 ? "" : "s"})` : ", no hints"} 🎉`} score={d.doneMs!} saved={d.saved} onSaved={(b) => { d.setBoard(b); d.setSaved(true); }} />}
      {!past && <TodayBoard board={d.board} show={clock} />}
    </div>
  );
}
