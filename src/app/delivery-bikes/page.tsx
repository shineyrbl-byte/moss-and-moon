"use client";
import "./page.css";
import { useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import ArchiveNote from "@/components/ArchiveNote";
import { DoneCard, TodayBoard, useDaily } from "@/components/DailyDone";
import { isPast } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { FLEET, HINT_MS, N, bikesFor, isSolved, nextMark, problems, type Mark } from "@/lib/bikes";
import { addFlag } from "@/lib/trophyFlags";

export default function DeliveryBikes() {
  const { toast } = useStore();
  const d = useDaily<Mark[]>("bikes", "mm-bikes", () => Array(N * N).fill(0));
  const [history, setHistory] = useState<Mark[][]>([]);
  const p = useMemo(() => (d.date ? bikesFor(d.date) : null), [d.date]);
  if (!p || !d.state) return <div className="page"><p className="muted">Parking the bikes…</p></div>;
  const shown = new Map(p.shown.map((s) => [s.i, s.bike]));
  const marks = d.state.map((m, i) => (shown.has(i) ? (shown.get(i) ? 2 : 1) : m)) as Mark[];
  const done = d.doneMs !== null, past = isPast(d.date), bad = problems(p, marks);
  const rowHave = (r: number) => marks.slice(r * N, r * N + N).filter((m) => m === 2).length;
  const colHave = (c: number) => marks.filter((m, i) => m === 2 && i % N === c).length;
  function put(next: Mark[], usedHint = false) {
    const t = d.tick();
    setHistory([...history, d.state!]); d.setState(next);
    const full = next.map((m, i) => (shown.has(i) ? (shown.get(i) ? 2 : 1) : m)) as Mark[];
    if (isSolved(p!, full)) {
      const h = d.hints + (usedHint ? 1 : 0);
      d.setDoneMs(Date.now() - t + h * HINT_MS);
      if (!h) addFlag("bikes-no-hints");
      toast("Every bike found! 🚲🎉");
    }
  }
  function tap(i: number) { if (!done && !shown.has(i)) put(d.state!.map((m, k) => (k === i ? nextMark(m) : m))); }
  function hint() {
    const wrong = marks.findIndex((m, i) => !shown.has(i) && ((m === 2 && !p!.answer[i]) || (m === 1 && p!.answer[i])));
    const at = wrong >= 0 ? wrong : p!.answer.findIndex((b, i) => b && marks[i] !== 2);
    if (at < 0) return;
    d.setHints(d.hints + 1);
    put(d.state!.map((m, k) => (k === at ? (p!.answer[at] ? 2 : 0) : m)), true);
  }
  const fill = () => put(d.state!.map((m, i) => (m === 0 && !shown.has(i) ? 1 : m)));
  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={d.date} path="/delivery-bikes" />
      <h1 className="h2">Delivery <em>bikes</em></h1>
      <p className="small muted">The café&apos;s delivery bikes are parked in the lane: one 4 long, two 3s, two 2s and two scooters of 1. The numbers say how many squares in each row and column are bike. Bikes never touch each other, not even corner to corner. Tap once for bike, twice for road. There&apos;s only one answer.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={hint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { const h = history[history.length - 1]; if (h) { d.setState(h); setHistory(history.slice(0, -1)); } }} disabled={!history.length || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={fill} disabled={done}>Fill the rest with road</button>
        <span className="memory-stats"><span>⏱ {clock(d.elapsed + d.hints * HINT_MS)}</span></span>
      </div>
      <p className="center small" aria-label="The fleet">{FLEET.map((l, k) => <span key={k} className="db-ship" aria-label={`${l} long`}>{"▮".repeat(l)}</span>)}</p>
      <div className={`db-board ${done ? "done" : ""}`} style={{ ["--n" as string]: N }}>
        <span aria-hidden="true" />
        {[...Array(N).keys()].map((c) => <span key={c} className={`db-count ${colHave(c) === p.cols[c] ? "met" : ""} ${bad.has(-100 - c) ? "bad" : ""}`} aria-label={`Column ${c + 1} has ${p.cols[c]}`}>{p.cols[c]}</span>)}
        {[...Array(N).keys()].map((r) => [
          <span key={`r${r}`} className={`db-count ${rowHave(r) === p.rows[r] ? "met" : ""} ${bad.has(-1 - r) ? "bad" : ""}`} aria-label={`Row ${r + 1} has ${p.rows[r]}`}>{p.rows[r]}</span>,
          ...[...Array(N).keys()].map((c) => {
            const i = r * N + c, m = marks[i];
            return (
              <button key={i} className={`db-cell ${m === 2 ? "bike" : m === 1 ? "road" : ""} ${shown.has(i) ? "shown" : ""} ${bad.has(i) ? "bad" : ""}`} onClick={() => tap(i)} disabled={done || shown.has(i)}
                aria-label={`Row ${r + 1}, column ${c + 1}: ${m === 2 ? "bike" : m === 1 ? "road" : "unknown"}${shown.has(i) ? ", given" : ""}`}>{m === 2 ? "🚲" : m === 1 ? "·" : ""}</button>
            );
          }),
        ])}
      </div>
      <p className="tiny muted center">Row and column numbers turn green when they&apos;re met; bikes that touch corner to corner turn red.</p>
      {done && <DoneCard replay={d.replay} game="bikes" title="Delivery bikes" date={d.date} past={past} headline={`Fleet found in ${clock(d.doneMs ?? 0)}${d.hints ? ` (${d.hints} hint${d.hints === 1 ? "" : "s"})` : ", no hints"} 🎉`} score={d.doneMs!} saved={d.saved} onSaved={(b) => { d.setBoard(b); d.setSaved(true); }} />}
      {!past && <TodayBoard board={d.board} show={clock} />}
    </div>
  );
}
