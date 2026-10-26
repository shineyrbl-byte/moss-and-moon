"use client";
import "./page.css";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { playDay } from "@/lib/archive";
import { ICONS, sudokuFor } from "@/lib/sudoku";
import { N as MN, milkFor } from "@/lib/binairo";
import { N as QN, tableFor } from "@/lib/queens";
import { N as TN, terraceFor } from "@/lib/tents";
import { N as KN, jarFor, label } from "@/lib/kenken";
import { N as SN, towersFor } from "@/lib/skyscrapers";
import { N as HN, cupsFor } from "@/lib/hitori";
import { N as BN, sumsFor } from "@/lib/kakuro";

// Paper-friendly greys for Table for one's sections
const SHADE = ["#ffffff", "#e8e8e8", "#cfcfcf", "#f4f4f4", "#dcdcdc", "#bdbdbd", "#efefef", "#c6c6c6"];
type Grid = { n: number; cell: (i: number) => React.ReactNode; cls?: (i: number) => string; style?: (i: number) => React.CSSProperties };
function Paper({ g }: { g: Grid }) {
  return (
    <div className="pp-grid" style={{ ["--n" as string]: g.n }}>
      {[...Array(g.n * g.n).keys()].map((i) => <span key={i} className={`pp-cell ${g.cls?.(i) ?? ""}`} style={g.style?.(i)}>{g.cell(i)}</span>)}
    </div>
  );
}
/** Thicker lines where two different groups meet */
const edges = (n: number, group: number[], i: number) => {
  const r = Math.floor(i / n), c = i % n, me = group[i];
  return `${r > 0 && group[i - n] !== me ? "et " : ""}${c > 0 && group[i - 1] !== me ? "el " : ""}`;
};

export default function PrintPuzzles() {
  const [date, setDate] = useState("");
  const [answers, setAnswers] = useState(false);
  useEffect(() => { setDate(playDay()); }, []);
  const all = useMemo(() => {
    if (!date) return null;
    const sudoku = sudokuFor(date, "easy"), milk = milkFor(date), table = tableFor(date), terrace = terraceFor(date);
    const jar = jarFor(date), towers = towersFor(date), cups = cupsFor(date), sums = sumsFor(date);
    const cageOf = Array(KN * KN).fill(0); jar.cages.forEach((c, k) => c.cells.forEach((i) => { cageOf[i] = k; }));
    const sumClue = (i: number, across: boolean) => sums.runs.find((r) => r.clue === i && r.across === across)?.sum;
    const sq = (n: number) => (i: number) => ({ r: Math.floor(i / n), c: i % n });
    return [
      { title: "Mini sudoku", how: "Each picture once in every row, column and 2×3 box.", g: { n: 6, cell: (i: number) => ICONS[(answers ? sudoku.answer : sudoku.puzzle)[i] - 1] ?? "", cls: (i: number) => `${i % 6 === 2 ? "br" : ""} ${Math.floor(i / 6) % 2 === 1 && i < 30 ? "bb" : ""}` } },
      { title: "Milk & coffee", how: "M or C in every square. Never three the same in a line; four of each in every row and column.", g: { n: MN, cell: (i: number) => { const v = answers ? milk.solution[i] : milk.given[i]; return v === -1 ? "" : v ? "C" : "M"; }, cls: (i: number) => (milk.given[i] !== -1 ? "fixed" : "") } },
      { title: "Table for one", how: "One guest in every row, column and shaded section. No two guests touching, even corner to corner.", g: { n: QN, cell: (i: number) => (answers && table.seats.includes(i) ? "●" : ""), style: (i: number) => ({ background: SHADE[table.regions[i] % SHADE.length] }), cls: (i: number) => edges(QN, table.regions, i) } },
      { title: "Parasols", how: "A parasol beside every table (T). Parasols never touch. Numbers give how many in each row and column.", g: { n: TN + 1, cell: (i: number) => { const { r, c } = sq(TN + 1)(i); if (!r && !c) return ""; if (!r) return terrace.cols[c - 1]; if (!c) return terrace.rows[r - 1]; const k = (r - 1) * TN + (c - 1); return terrace.tables.includes(k) ? "T" : answers && terrace.parasols.includes(k) ? "⛱" : ""; }, cls: (i: number) => { const { r, c } = sq(TN + 1)(i); return !r || !c ? "clue" : ""; } } },
      { title: "Tip jar", how: "1 to 5 once in every row and column. Each outlined jar makes its number with its sign.", g: { n: KN, cell: (i: number) => <>{jar.cages[cageOf[i]].cells[0] === i && <small>{label(jar.cages[cageOf[i]])}</small>}{answers ? jar.solution[i] : ""}</>, cls: (i: number) => edges(KN, cageOf, i) } },
      { title: "Cake towers", how: "1 to 5 once in every row and column. Edge numbers say how many cakes you can see from that side.", g: { n: SN + 2, cell: (i: number) => { const { r, c } = sq(SN + 2)(i); const k = r === 0 && c >= 1 && c <= SN ? c - 1 : c === SN + 1 && r >= 1 && r <= SN ? SN + r - 1 : r === SN + 1 && c >= 1 && c <= SN ? 2 * SN + c - 1 : c === 0 && r >= 1 && r <= SN ? 3 * SN + r - 1 : null; if (k !== null) return towers.clues[k] || ""; if (!r || !c || r > SN || c > SN) return ""; return answers ? towers.solution[(r - 1) * SN + c - 1] : ""; }, cls: (i: number) => { const { r, c } = sq(SN + 2)(i); return !r || !c || r > SN || c > SN ? "clue" : ""; } } },
      { title: "Spare cups", how: "Shade cups so no number repeats in a row or column. Shaded cups never touch side by side; the rest must all join up.", g: { n: HN, cell: (i: number) => cups.nums[i], cls: (i: number) => (answers && cups.away.includes(i) ? "shade" : "") } },
      { title: "Bean sums", how: "1 to 9 in the white squares. Runs add up to their clue (top: across, bottom: down), no repeats in a run.", g: { n: BN, cell: (i: number) => (sums.white[i] ? (answers ? sums.solution[i] : sums.given[i] || "") : <>{sumClue(i, true) && <small className="a">{sumClue(i, true)}</small>}{sumClue(i, false) && <small className="d">{sumClue(i, false)}</small>}</>), cls: (i: number) => (sums.white[i] ? (sums.given[i] ? "fixed" : "") : "black") } },
    ];
  }, [date, answers]);
  if (!all) return <div className="page"><p className="muted">Warming up the printer…</p></div>;
  const nice = new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="page pp-page" style={{ maxWidth: "52rem" }}>
      <div className="pp-screen">
        <p className="eyebrow">games corner</p>
        <h1 className="h2">Print the <em>puzzles</em></h1>
        <p className="small muted">Today&apos;s eight grid puzzles on paper, for the commute or a slow coffee. Times on paper don&apos;t go on the boards. Add <code>?day=</code> to print an archive day, or tick the box for the answers.</p>
        <div className="row" style={{ gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn-pink btn-sm" onClick={() => window.print()}>🖨 Print</button>
          <label className="small row" style={{ gap: "0.35rem", alignItems: "center" }}><input type="checkbox" checked={answers} onChange={(e) => setAnswers(e.target.checked)} /> Show the answers</label>
          <Link className="small" href="/games">← Back to the games</Link>
        </div>
      </div>
      <h2 className="pp-head">Moss &amp; Moon puzzles · {nice}{answers ? " · answers" : ""}</h2>
      <div className="pp-sheet">
        {all.map((p) => (
          <section key={p.title} className="pp-box">
            <h3>{p.title}</h3>
            <p>{p.how}</p>
            <Paper g={p.g} />
          </section>
        ))}
      </div>
    </div>
  );
}
