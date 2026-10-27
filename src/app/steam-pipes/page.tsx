"use client";
import "./page.css";
import { Ghost } from "@/components/GameExtras";
import { useMemo } from "react";
import { useStore } from "@/components/Store";
import ArchiveNote from "@/components/ArchiveNote";
import { DoneCard, TodayBoard, useDaily } from "@/components/DailyDone";
import { isPast } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { DOWN, HINT_MS, LEFT, N, RIGHT, SOURCE, UP, fixTurns, flow, isSolved, pipesFor, sidesNow, wrongTiles } from "@/lib/pipes";
import { addFlag } from "@/lib/trophyFlags";

// One tile's pipes, drawn from the middle out to each open side
function Tile({ mask, source, cup, wet }: { mask: number; source: boolean; cup: boolean; wet: boolean }) {
  const ends: [number, number, number][] = [[UP, 50, 0], [RIGHT, 100, 50], [DOWN, 50, 100], [LEFT, 0, 50]];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {ends.filter(([b]) => mask & b).map(([b, x, y]) => <line key={b} x1={50} y1={50} x2={x} y2={y} className={`sp-pipe ${wet ? "wet" : ""}`} />)}
      <circle cx={50} cy={50} r={source ? 0 : 9} className={`sp-joint ${wet ? "wet" : ""}`} />
      {source && <text x={50} y={64} textAnchor="middle" fontSize={44}>☕</text>}
      {cup && <text x={50} y={62} textAnchor="middle" fontSize={34}>{wet ? "♨️" : "🍵"}</text>}
    </svg>
  );
}
const SIDES = (m: number) => [UP, RIGHT, DOWN, LEFT].filter((b) => m & b).length;
const NAMES: Record<number, string> = { [UP]: "up", [RIGHT]: "right", [DOWN]: "down", [LEFT]: "left" };

export default function SteamPipes() {
  const { toast } = useStore();
  const d = useDaily<number[]>("pipes", "mm-pipes", () => Array(N * N).fill(0));
  const puzzle = useMemo(() => (d.date ? pipesFor(d.date) : null), [d.date]);
  if (!puzzle || !d.state) return <div className="page"><p className="muted">Plumbing the café…</p></div>;
  const turns = d.state, { tiles, spins } = puzzle, done = d.doneMs !== null, past = isPast(d.date);
  const { reached, leaks } = flow(tiles, spins, turns);

  function put(next: number[], usedHint = false) {
    const t = d.tick();
    d.setState(next);
    if (isSolved(tiles, spins, next)) {
      const h = d.hints + (usedHint ? 1 : 0);
      d.setDoneMs(Date.now() - t + h * HINT_MS);
      if (!h) addFlag("pipes-no-hints");
      toast("Steam in every cup! ♨️🎉");
    }
  }
  function spin(i: number, by = 1) { if (!done) put(turns.map((x, k) => (k === i ? (x + by + 4) % 4 : x))); }
  function hint() {
    const i = wrongTiles(tiles, spins, turns)[0];
    if (i === undefined) return;
    d.setHints(d.hints + 1);
    put(turns.map((x, k) => (k === i ? (x + fixTurns(tiles, spins, turns, k)) % 4 : x)), true);
  }
  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={d.date} path="/steam-pipes" />
      <h1 className="h2">Steam <em>pipes</em></h1>
      <p className="small muted">Someone&apos;s spun all the pipes. Tap a tile to turn it a quarter (on a computer, right-click turns it back). Get steam from the espresso machine in the middle to every cup, with no pipe left open. Steam glows as it gets through.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={hint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
      </div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>♨️ <b>{reached.size}</b>/{N * N}</span><span>Open ends <b>{leaks}</b></span><span className="mm-clock">⏱ {clock(d.elapsed + d.hints * HINT_MS)}</span></div>
      <Ghost elapsed={d.elapsed} done={d.doneMs !== null} />
      <div className={`sp-grid ${done ? "done" : ""}`} style={{ ["--n" as string]: N }} role="grid" aria-label="Pipes">
        {tiles.map((_, i) => {
          const m = sidesNow(tiles, spins, turns, i), cup = i !== SOURCE && SIDES(tiles[i]) === 1;
          return (
            <button key={i} className={`sp-tile ${reached.has(i) ? "wet" : ""}`} onClick={() => spin(i)} onContextMenu={(e) => { e.preventDefault(); spin(i, -1); }} disabled={done}
              aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}: ${i === SOURCE ? "espresso machine, " : cup ? "cup, " : ""}open ${[UP, RIGHT, DOWN, LEFT].filter((b) => m & b).map((b) => NAMES[b]).join(" and ")}${reached.has(i) ? ", has steam" : ""}`}>
              <Tile mask={m} source={i === SOURCE} cup={cup} wet={reached.has(i)} />
            </button>
          );
        })}
      </div>
      {done && <DoneCard replay={d.replay} proof={d.state} game="pipes" title="Steam pipes" date={d.date} past={past} headline={`Piped in ${clock(d.doneMs ?? 0)}${d.hints ? ` (${d.hints} hint${d.hints === 1 ? "" : "s"})` : ", no hints"} 🎉`} score={d.doneMs!} saved={d.saved} onSaved={(b) => { d.setBoard(b); d.setSaved(true); }} />}
      {!past && <TodayBoard board={d.board} show={clock} />}
    </div>
  );
}
