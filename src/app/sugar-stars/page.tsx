"use client";
import "./page.css";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import ArchiveNote from "@/components/ArchiveNote";
import { DoneCard, TodayBoard, useDaily } from "@/components/DailyDone";
import { isPast } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { HINT_MS, N, STARS, borders, isSolved, nextMark, problems, starsFor, touching, type Mark } from "@/lib/starBattle";
import { addFlag } from "@/lib/trophyFlags";

// Ten soft tray colours, so the outlined areas are easy to tell apart (borders carry it too, for colour-blind players)
const TINTS = ["#f6dce3", "#f3e3c8", "#dfe8d3", "#dde7f2", "#ece0f3", "#f8e9c4", "#e4ecdf", "#f4d9cc", "#d9ecec", "#efe2d6"];
const DARK = ["#5a3a44", "#58472f", "#3e4a36", "#38465a", "#4b3c58", "#5a4a26", "#3e4a3a", "#5a3b30", "#2f4a4a", "#4f4234"];

export default function SugarStars() {
  const { toast } = useStore();
  const d = useDaily<Mark[]>("stars", "mm-stars", () => Array(N * N).fill(0));
  const [history, setHistory] = useState<Mark[][]>([]);
  const [puzzle, setPuzzle] = useState<{ region: number[]; stars: number[] } | null>(null);
  const [auto, setAuto] = useState(true);
  // Building some days' trays takes a moment, so let the page paint first
  useEffect(() => { if (!d.date) return; const id = setTimeout(() => setPuzzle(starsFor(d.date)), 20); return () => clearTimeout(id); }, [d.date]);
  if (!puzzle || !d.state) return <div className="page"><p className="muted">Sprinkling the sugar stars…</p></div>;
  const marks = d.state, { region, stars } = puzzle, done = d.doneMs !== null, past = isPast(d.date);
  const bad = problems(region, marks);
  const mine = marks.flatMap((m, i) => (m === 2 ? [i] : []));
  // Squares a star rules out: its neighbours (shown faintly when "auto dots" is on)
  const ruled = new Set(auto ? mine.flatMap((s) => [...Array(N * N).keys()].filter((j) => touching(s, j))) : []);

  function put(next: Mark[], usedHint = false) {
    const t = d.tick();
    setHistory([...history, marks]); d.setState(next);
    if (isSolved(stars, next)) {
      const h = d.hints + (usedHint ? 1 : 0);
      d.setDoneMs(Date.now() - t + h * HINT_MS);
      if (!h) addFlag("stars-no-hints");
      toast("Every tray has its two stars! ⭐🎉");
    }
  }
  function tap(i: number) { if (!done) { const next = [...marks]; next[i] = nextMark(next[i]); put(next); } }
  function hint() {
    const wrong = marks.findIndex((m, i) => m === 2 && !stars.includes(i));
    const next = [...marks];
    if (wrong >= 0) next[wrong] = 0;
    else { const at = stars.find((i) => marks[i] !== 2); if (at === undefined) return; next[at] = 2; }
    d.setHints(d.hints + 1); put(next, true);
  }
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={d.date} path="/sugar-stars" />
      <h1 className="h2">Sugar <em>stars</em></h1>
      <p className="small muted">A star battle. Put {STARS} stars in every row, every column and every outlined tray. Stars can&apos;t touch, not even corner to corner. Tap once for a star, twice for a dot to say &ldquo;no star here&rdquo;. There&apos;s only one answer.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={hint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { const p = history[history.length - 1]; if (p) { d.setState(p); setHistory(history.slice(0, -1)); } }} disabled={!history.length || done}>↩ Undo</button>
        <button className={`chip ${auto ? "on" : ""}`} aria-pressed={auto} onClick={() => setAuto(!auto)}>Auto dots</button>
      </div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>⭐ <b>{mine.length}</b>/{N * STARS}</span><span>⏱ {clock(d.elapsed + d.hints * HINT_MS)}</span></div>
      <div className={`sb-grid ${done ? "done" : ""}`} style={{ ["--n" as string]: N }} role="grid" aria-label="Sugar stars">
        {region.map((g, i) => {
          const b = borders(region, i), m = marks[i];
          return (
            <button key={i} className={`sb-cell ${b.right ? "br" : ""} ${b.down ? "bd" : ""} ${bad.has(i) ? "bad" : ""}`} style={{ ["--t" as string]: TINTS[g], ["--td" as string]: DARK[g] }} onClick={() => tap(i)} disabled={done}
              aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}, tray ${g + 1}: ${m === 2 ? "star" : m === 1 ? "dot" : "empty"}`}>
              {m === 2 ? <span aria-hidden="true">⭐</span> : m === 1 || ruled.has(i) ? <span className={`sb-dot ${m === 1 ? "" : "auto"}`} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
      <p className="tiny muted center">Thick lines mark the trays. Stars that break a rule turn red.</p>
      {done && <DoneCard replay={d.replay} game="stars" title="Sugar stars" date={d.date} past={past} headline={`Starred in ${clock(d.doneMs ?? 0)}${d.hints ? ` (${d.hints} hint${d.hints === 1 ? "" : "s"})` : ", no hints"} 🎉`} score={d.doneMs!} saved={d.saved} onSaved={(b) => { d.setBoard(b); d.setSaved(true); }} />}
      {!past && <TodayBoard board={d.board} show={clock} />}
    </div>
  );
}
