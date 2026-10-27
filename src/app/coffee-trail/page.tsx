"use client";
import "./page.css";
import { Ghost } from "@/components/GameExtras";
import { useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import ArchiveNote from "@/components/ArchiveNote";
import { DoneCard, TodayBoard, useDaily } from "@/components/DailyDone";
import { isPast } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { HINT_MS, LAST, N, isSolved, problems, touches, trailFor } from "@/lib/hidato";
import { addFlag } from "@/lib/trophyFlags";

export default function CoffeeTrail() {
  const { toast } = useStore();
  const d = useDaily<number[]>("trail", "mm-trail", () => Array(N * N).fill(0));
  const [cur, setCur] = useState(1);
  const [history, setHistory] = useState<number[][]>([]);
  const puzzle = useMemo(() => (d.date ? trailFor(d.date) : null), [d.date]);
  if (!puzzle || !d.state) return <div className="page"><p className="muted">Laying the trail…</p></div>;
  const mine = d.state, { given, answer } = puzzle, done = d.doneMs !== null, past = isPast(d.date);
  const all = given.map((g, i) => g || mine[i]);
  const where = (v: number) => all.indexOf(v);
  const bad = problems(given, mine);
  const curAt = where(cur);
  const next = cur + 1;

  function put(nextMine: number[], usedHint = false) {
    const t = d.tick();
    setHistory([...history, mine]); d.setState(nextMine);
    if (isSolved(answer, given, nextMine)) {
      const h = d.hints + (usedHint ? 1 : 0);
      d.setDoneMs(Date.now() - t + h * HINT_MS);
      if (!h) addFlag("trail-no-hints");
      toast("The trail's complete! ☕🎉");
    }
  }
  function tap(i: number) {
    if (done) return;
    if (all[i]) {
      // Tap a number to carry on from it; tap your own selected number again to take it off
      if (!given[i] && all[i] === cur) { const m = [...mine]; m[i] = 0; put(m); setCur(Math.max(1, cur - 1)); return; }
      setCur(all[i]); return;
    }
    if (next > LAST) return;
    if (curAt < 0) return toast(`Pick a number first: ${cur} isn't on the tray.`);
    if (!touches(curAt, i)) return toast(`${next} has to touch ${cur}, side by side or corner to corner.`);
    if (given.includes(next)) return toast(`${next} is already on the tray. Tap it to carry on from there.`);
    const m = mine.map((v) => (v === next ? 0 : v)); m[i] = next;
    put(m); setCur(next);
  }
  function hint() {
    // Take off a wrong number, or else put in the lowest missing one
    const wrong = mine.findIndex((v, i) => v && v !== answer[i]);
    const m = [...mine];
    if (wrong >= 0) m[wrong] = 0;
    else { const v = [...Array(LAST).keys()].map((k) => k + 1).find((v) => !all.includes(v)); if (!v) return; m[answer.indexOf(v)] = v; setCur(v); }
    d.setHints(d.hints + 1); put(m, true);
  }
  const placed = all.filter(Boolean).length;
  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={d.date} path="/coffee-trail" />
      <h1 className="h2">Coffee <em>trail</em></h1>
      <p className="small muted">Fill the tray with 1 to {LAST} so each number touches the next, side by side or corner to corner. Some numbers are already down. Tap a number to start from it, then tap a touching square to put the next number there. Tap your last number again to take it back. There&apos;s only one way through.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={hint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { const p = history[history.length - 1]; if (p) { d.setState(p); setHistory(history.slice(0, -1)); } }} disabled={!history.length || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setHistory([...history, mine]); d.setState(Array(N * N).fill(0)); setCur(1); }} disabled={done || mine.every((v) => !v)}>Start over</button>
      </div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}>
        <span>{done ? "Done" : next <= LAST && !given.includes(next) ? <>Next: <b>{next}</b></> : <>On <b>{cur}</b></>}</span>
        <span><b>{placed}</b>/{LAST}</span><span className="mm-clock">⏱ {clock(d.elapsed + d.hints * HINT_MS)}</span>
      </div>
      <Ghost elapsed={d.elapsed} done={d.doneMs !== null} />
      <div className={`ct-grid ${done ? "done" : ""}`} style={{ ["--n" as string]: N }} role="group" data-grid="" aria-label="Coffee trail">
        {all.map((v, i) => {
          const canGo = !done && !v && curAt >= 0 && touches(curAt, i) && next <= LAST && !given.includes(next);
          return (
            <button key={i} className={`ct-cell ${given[i] ? "given" : v ? "mine" : ""} ${i === curAt && !done ? "cur" : ""} ${canGo ? "can" : ""} ${bad.has(i) ? "bad" : ""} ${v === 1 || v === LAST ? "end" : ""}`}
              onClick={() => tap(i)} disabled={done}
              aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}: ${v ? `${v}${given[i] ? ", given" : ""}` : canGo ? `empty, ${next} can go here` : "empty"}`}>
              {v ? v : canGo ? <span className="ct-ghost" aria-hidden="true">{next}</span> : null}
            </button>
          );
        })}
      </div>
      <p className="tiny muted center">The faint numbers show where the next one could go. Numbers that can&apos;t be right turn red.</p>
      {done && <DoneCard replay={d.replay} proof={d.state} game="trail" title="Coffee trail" date={d.date} past={past} headline={`Trail laid in ${clock(d.doneMs ?? 0)}${d.hints ? ` (${d.hints} hint${d.hints === 1 ? "" : "s"})` : ", no hints"} 🎉`} score={d.doneMs!} saved={d.saved} onSaved={(b) => { d.setBoard(b); d.setSaved(true); }} />}
      {!past && <TodayBoard board={d.board} show={clock} />}
    </div>
  );
}
