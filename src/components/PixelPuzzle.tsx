"use client";
import { useMemo, useRef, useState } from "react";
import { COLOURS, colOf, runs, type Run } from "@/lib/colourPixels";

const NAMES: Record<string, string> = { p: "pink", b: "brown", g: "green", y: "yellow", r: "red", x: "crossed off" };
const Clue = ({ r, dir }: { r: Run[]; dir: "row" | "col" }) => <span className={`cp-clue ${dir}`}>{r.length ? r.map((x, k) => <b key={k} style={{ background: COLOURS[x.c] }}>{x.n}</b>) : <i>0</i>}</span>;

/** A colour pixel picture to paint (for the season packs): calls onSolved with the time it took */
export default function PixelPuzzle({ rows, onSolved, solved }: { rows: string[]; onSolved: (ms: number) => void; solved: boolean }) {
  const n = rows.length;
  const [cells, setCells] = useState<string[]>(() => Array(n * n).fill("?"));
  const colours = useMemo(() => [...new Set(rows.join("").replace(/\./g, ""))], [rows]);
  const [pen, setPen] = useState(colours[0]);
  const started = useRef<number | null>(null);
  const rowClues = rows.map(runs), colClues = [...Array(n).keys()].map((c) => runs(colOf(rows, c)));
  function paint(i: number) {
    if (solved) return;
    started.current ??= Date.now();
    const next = cells.map((c, k) => (k === i ? (c === pen ? "?" : pen) : c));
    setCells(next);
    if (next.map((c) => (c === "x" || c === "?" ? "." : c)).join("") === rows.join("")) onSolved(Date.now() - started.current);
  }
  const shown = solved ? rows.join("").split("") : cells;
  return (
    <>
      <div className="row" style={{ gap: "0.4rem", justifyContent: "center" }}>
        {[...colours, "x"].map((c) => <button key={c} className={`cp-pen ${pen === c ? "on" : ""}`} style={c !== "x" ? { background: COLOURS[c] } : undefined} onClick={() => setPen(c)} aria-pressed={pen === c} aria-label={NAMES[c]} disabled={solved}>{c === "x" ? "✕" : ""}</button>)}
      </div>
      <div className={`cp-board ${solved ? "done" : ""}`} style={{ gridTemplateColumns: `auto repeat(${n}, 1fr)` }}>
        <span />
        {colClues.map((r, c) => <Clue key={c} r={r} dir="col" />)}
        {[...Array(n).keys()].map((r) => [
          <Clue key={`r${r}`} r={rowClues[r]} dir="row" />,
          ...[...Array(n).keys()].map((c) => { const i = r * n + c, v = shown[i]; return <button key={i} className={`cp-cell ${v === "x" ? "x" : ""}`} style={v !== "?" && v !== "x" && v !== "." ? { background: COLOURS[v] } : undefined} onClick={() => paint(i)} aria-label={`Row ${r + 1}, column ${c + 1}: ${NAMES[v] ?? "empty"}`}>{v === "x" ? "✕" : ""}</button>; }),
        ])}
      </div>
    </>
  );
}
