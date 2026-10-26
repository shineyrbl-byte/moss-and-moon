"use client";
import "./page.css";
import { useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import ArchiveNote from "@/components/ArchiveNote";
import { DoneCard, TodayBoard, useDaily } from "@/components/DailyDone";
import { isPast } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { HINT_MS, N, cover, cuttersFor, isSolved, layout, orient, shapeOf, type Placed } from "@/lib/cutters";
import { addFlag } from "@/lib/trophyFlags";

type S = { placed: Placed[]; orients: number[] };
const COLOURS = ["#e391a8", "#c99a6b", "#9fae8d", "#e8b86a", "#a5c8e8", "#c9b0e2"];

function Mini({ name, o, colour }: { name: string; o: number; colour: string }) {
  const sh = orient(shapeOf(name), o), h = Math.max(...sh.map((p) => p[0])) + 1, w = Math.max(...sh.map((p) => p[1])) + 1;
  return (
    <svg viewBox={`0 0 ${w * 10} ${h * 10}`} style={{ width: `${w * 1.05}rem`, height: `${h * 1.05}rem` }} aria-hidden="true">
      {sh.map(([r, c]) => <rect key={`${r}-${c}`} x={c * 10 + 0.6} y={r * 10 + 0.6} width={8.8} height={8.8} rx={2.4} fill={colour} />)}
    </svg>
  );
}

export default function CookieCutters() {
  const { toast } = useStore();
  const d = useDaily<S>("cutters", "mm-cutters", (date) => { const p = cuttersFor(date); return { placed: p.pieces.map(() => null), orients: p.pieces.map(() => 0) }; });
  const [sel, setSel] = useState<number | null>(0);
  const [hover, setHover] = useState<number | null>(null);
  const puzzle = useMemo(() => (d.date ? cuttersFor(d.date) : null), [d.date]);
  if (!puzzle || !d.state) return <div className="page"><p className="muted">Rolling out the dough…</p></div>;
  const s = d.state, done = d.doneMs !== null, past = isPast(d.date);
  const { owner } = layout(puzzle, s.placed);
  /** Where the picked cutter goes if you tap square i: its first square there, or any way round that covers i and fits */
  function spotFor(i: number): number | undefined {
    if (sel === null) return undefined;
    const shape = shapeOf(puzzle!.pieces[sel]), o = s.orients[sel], sh = orient(shape, o);
    const fits = (at: number) => { const c = cover(shape, o, at); return !!c && c.includes(i) && c.every((j) => puzzle!.dough[j] && owner[j] < 0); };
    return sh.map(([r, c]) => (Math.floor(i / N) - (r - sh[0][0])) * N + (i % N) - (c - sh[0][1])).filter((at) => at >= 0 && at < N * N).find(fits);
  }
  const canPreview = sel !== null && hover !== null && !s.placed[sel] && owner[hover] < 0;
  const spot = canPreview ? spotFor(hover!) : undefined;
  const preview = canPreview ? (spot !== undefined ? cover(shapeOf(puzzle.pieces[sel!]), s.orients[sel!], spot) : cover(shapeOf(puzzle.pieces[sel!]), s.orients[sel!], hover!)) : null;
  const previewOk = spot !== undefined;

  function put(next: S, usedHint = false) {
    const t = d.tick();
    d.setState(next);
    if (isSolved(puzzle!, next.placed)) {
      const h = d.hints + (usedHint ? 1 : 0);
      d.setDoneMs(Date.now() - t + h * HINT_MS);
      if (!h) addFlag("cutters-no-hints");
      toast("Every cutter fits! 🍪🎉");
    }
  }
  function tapSquare(i: number) {
    if (done) return;
    if (owner[i] >= 0) {
      // Lift a cutter back off the dough
      const k = owner[i];
      put({ ...s, placed: s.placed.map((p, j) => (j === k ? null : p)) }); setSel(k); return;
    }
    if (sel === null || s.placed[sel]) return toast("Pick a cutter from the tray first.");
    const at = spotFor(i);
    if (at === undefined) return toast("That cutter doesn't fit there, this way round.");
    const placed = s.placed.map((p, j) => (j === sel ? { o: s.orients[sel], at } : p));
    put({ ...s, placed });
    const nextFree = placed.findIndex((p) => !p);
    setSel(nextFree >= 0 ? nextFree : null); setHover(null);
  }
  function turnSel(by: number) {
    if (sel === null || done) return;
    const o = s.orients[sel], next = by === 4 ? (o + 4) % 8 : (o < 4 ? (o + 1) % 4 : 4 + ((o + 1) % 4));
    d.setState({ ...s, orients: s.orients.map((x, j) => (j === sel ? next : x)), placed: s.placed.map((p, j) => (j === sel ? null : p)) });
  }
  function hint() {
    // Put one cutter where the answer has it, lifting anything in the way
    const k = puzzle!.pieces.findIndex((_, j) => { const p = s.placed[j], a = puzzle!.answer[j]; return !p || p.o !== a.o || p.at !== a.at; });
    if (k < 0) return;
    const a = puzzle!.answer[k], cells = cover(shapeOf(puzzle!.pieces[k]), a.o, a.at)!;
    const placed = s.placed.map((p, j) => (j === k ? a : p && cover(shapeOf(puzzle!.pieces[j]), p.o, p.at)!.some((x) => cells.includes(x)) ? null : p));
    d.setHints(d.hints + 1);
    put({ placed, orients: s.orients.map((o, j) => (j === k ? a.o : o)) }, true);
    setSel(placed.findIndex((p) => !p) >= 0 ? placed.findIndex((p) => !p) : null);
  }
  const left = s.placed.filter((p) => !p).length;
  return (
    <div className="page" style={{ maxWidth: "32rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={d.date} path="/cookie-cutters" />
      <h1 className="h2">Cookie <em>cutters</em></h1>
      <p className="small muted">Fit every cutter into the dough, with no dough left over and nothing hanging off. Pick a cutter, turn or flip it, then tap the dough where it should go. Tap a cutter on the dough to lift it off again.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => turnSel(1)} disabled={sel === null || done}>↻ Turn</button>
        <button className="btn btn-ghost btn-sm" onClick={() => turnSel(4)} disabled={sel === null || done}>⇋ Flip</button>
        <button className="btn btn-ghost btn-sm" onClick={hint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { d.setState({ ...s, placed: s.placed.map(() => null) }); setSel(0); }} disabled={done || left === s.placed.length}>Start over</button>
      </div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>🍪 <b>{s.placed.length - left}</b>/{s.placed.length} in</span><span>⏱ {clock(d.elapsed + d.hints * HINT_MS)}</span></div>
      <div className={`cu-board ${done ? "done" : ""}`} style={{ ["--n" as string]: N }} role="grid" aria-label="Dough" onPointerLeave={() => setHover(null)}>
        {puzzle.dough.map((dough, i) => {
          const k = owner[i], inPreview = preview?.includes(i);
          return (
            <button key={i} className={`cu-sq ${dough ? "dough" : ""} ${inPreview ? (previewOk ? "pre" : "pre bad") : ""}`} disabled={done || (!dough && !inPreview)}
              style={k >= 0 ? { background: COLOURS[k % COLOURS.length] } : undefined}
              onPointerEnter={() => setHover(i)} onClick={() => tapSquare(i)}
              aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}: ${!dough ? "no dough" : k >= 0 ? `cutter ${k + 1}` : "dough"}`} />
          );
        })}
      </div>
      <div className="cu-tray" role="group" aria-label="Your cutters">
        {puzzle.pieces.map((name, k) => (
          <button key={k} className={`cu-piece ${sel === k ? "on" : ""} ${s.placed[k] ? "used" : ""}`} onClick={() => setSel(k)} disabled={done} aria-pressed={sel === k} aria-label={`Cutter ${k + 1}${s.placed[k] ? ", on the dough" : ""}`}>
            <Mini name={name} o={s.orients[k]} colour={COLOURS[k % COLOURS.length]} />
          </button>
        ))}
      </div>
      {done && <DoneCard replay={d.replay} game="cutters" title="Cookie cutters" date={d.date} past={past} headline={`All cut in ${clock(d.doneMs ?? 0)}${d.hints ? ` (${d.hints} hint${d.hints === 1 ? "" : "s"})` : ", no hints"} 🎉`} score={d.doneMs!} saved={d.saved} onSaved={(b) => { d.setBoard(b); d.setSaved(true); }} />}
      {!past && <TodayBoard board={d.board} show={clock} />}
    </div>
  );
}
