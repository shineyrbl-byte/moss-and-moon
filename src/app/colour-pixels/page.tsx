"use client";
import "./page.css";
import { useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import ArchiveNote from "@/components/ArchiveNote";
import { DoneCard, TodayBoard, useDaily } from "@/components/DailyDone";
import { Ghost } from "@/components/GameExtras";
import { isPast } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { COLOURS, HINT_MS, N, isSolved, pictureFor, type Run } from "@/lib/colourPixels";
import { addFlag } from "@/lib/trophyFlags";

const NAMES: Record<string, string> = { p: "pink", b: "brown", g: "green", y: "yellow", r: "red", ".": "blank", x: "crossed off" };
const Clue = ({ runs, dir }: { runs: Run[]; dir: "row" | "col" }) => (
  <span className={`cp-clue ${dir}`}>{runs.length ? runs.map((r, k) => <b key={k} style={{ background: COLOURS[r.c] }}>{r.n}</b>) : <i>0</i>}</span>
);

export default function ColourPixels() {
  const { toast } = useStore();
  const d = useDaily<string[]>("colour", "mm-colour", () => Array(N * N).fill("?"));
  const [pen, setPen] = useState("p");
  const pic = useMemo(() => (d.date ? pictureFor(d.date) : null), [d.date]);
  if (!pic || !d.state) return <div className="page"><p className="muted">Mixing the paints…</p></div>;
  const cells = d.state, done = d.doneMs !== null, past = isPast(d.date);
  const pens = [...pic.colours, "x"];
  const grid = pic.rows.join("");
  function paint(i: number, usedHint = false, value?: string) {
    if (done) return;
    const t = d.tick();
    const v = value ?? (cells[i] === pen ? "?" : pen);
    const next = cells.map((c, k) => (k === i ? v : c));
    d.setState(next);
    // Crossed-off squares count as blank when we check
    const asPicture = next.map((c) => (c === "x" || c === "?" ? "." : c));
    if (isSolved(pic!.rows, [...Array(N).keys()].map((r) => asPicture.slice(r * N, r * N + N).join("")))) {
      const h = d.hints + (usedHint ? 1 : 0);
      d.setDoneMs(Date.now() - t + h * HINT_MS);
      if (!h) addFlag("colour-no-hints");
      toast(`It's ${pic!.name.toLowerCase()}! 🎨🎉`);
    }
  }
  function hint() {
    const wrong = cells.findIndex((c, i) => c !== "?" && c !== "x" && c !== grid[i]);
    const i = wrong >= 0 ? wrong : cells.findIndex((c, i) => grid[i] !== "." && c !== grid[i]);
    if (i < 0) return;
    d.setHints(d.hints + 1); paint(i, true, grid[i] === "." ? "x" : grid[i]);
  }
  return (
    <div className="page" style={{ maxWidth: "32rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={d.date} path="/colour-pixels" />
      <h1 className="h2">Colour <em>pixels</em></h1>
      <p className="small muted">A pixel picture in colour. The numbers by each row and column are its runs of colour, in order. Runs of the same colour always have a gap between them; different colours can touch. Pick a colour, then tap squares. There&apos;s only one picture that fits.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        {pens.map((c) => <button key={c} className={`cp-pen ${pen === c ? "on" : ""}`} style={c !== "x" ? { background: COLOURS[c] } : undefined} onClick={() => setPen(c)} aria-pressed={pen === c} aria-label={NAMES[c]}>{c === "x" ? "✕" : ""}</button>)}
        <button className="btn btn-ghost btn-sm" onClick={hint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
        <span className="memory-stats"><span className="mm-clock">⏱ {clock(d.elapsed + d.hints * HINT_MS)}</span></span>
      </div>
      <Ghost elapsed={d.elapsed} done={done} />
      <div className={`cp-board ${done ? "done" : ""}`}>
        <span />
        {pic.colClues.map((r, c) => <Clue key={c} runs={r} dir="col" />)}
        {[...Array(N).keys()].map((r) => [
          <Clue key={`r${r}`} runs={pic.rowClues[r]} dir="row" />,
          ...[...Array(N).keys()].map((c) => {
            const i = r * N + c, v = cells[i];
            return <button key={i} className={`cp-cell ${v === "x" ? "x" : ""}`} style={v !== "?" && v !== "x" ? { background: COLOURS[v] } : undefined} onClick={() => paint(i)} aria-label={`Row ${r + 1}, column ${c + 1}: ${NAMES[v] ?? "empty"}`}>{v === "x" ? "✕" : ""}</button>;
          }),
        ])}
      </div>
      {done && <DoneCard replay={d.replay} game="colour" title="Colour pixels" date={d.date} past={past} headline={`${pic.name}, painted in ${clock(d.doneMs ?? 0)}${d.hints ? ` (${d.hints} hint${d.hints === 1 ? "" : "s"})` : ", no hints"} 🎨`} score={d.doneMs!} saved={d.saved} onSaved={(b) => { d.setBoard(b); d.setSaved(true); }} />}
      {!past && <TodayBoard board={d.board} show={clock} />}
    </div>
  );
}
