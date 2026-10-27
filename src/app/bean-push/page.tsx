"use client";
import "./page.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import ArchiveNote from "@/components/ArchiveNote";
import { DoneCard, TodayBoard, useDaily } from "@/components/DailyDone";
import { isPast } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { H, W, isSolved, levelFor, move, pack, start, type Dir, type State } from "@/lib/beanPush";
import { addFlag } from "@/lib/trophyFlags";

const KEYS: Record<string, Dir> = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3 };

export default function BeanPush() {
  const { toast } = useStore();
  const d = useDaily<State | null>("push", "mm-push", (date) => start(levelFor(date)));
  const [history, setHistory] = useState<State[]>([]);
  const l = useMemo(() => (d.date ? levelFor(d.date) : null), [d.date]);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      const dir = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
      if (dir !== undefined) { e.preventDefault(); go(dir); }
      else if (e.key === "u" || (e.key === "z" && (e.metaKey || e.ctrlKey))) { e.preventDefault(); undo(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  if (!l || !d.state) return <div className="page"><p className="muted">Stacking the sacks…</p></div>;
  const s = d.state, done = d.doneMs !== null, past = isPast(d.date);
  function go(dir: Dir) {
    if (done) return;
    const n = move(l!, s, dir);
    if (!n) return;
    const t = d.tick();
    setHistory([...history, s]); d.setState(n);
    if (isSolved(l!, n)) { d.setDoneMs(Date.now() - t); if (n.moves <= l!.par * 2) addFlag("push-tidy"); toast(`All the sacks are in! ${n.moves} moves 🫘🎉`); }
  }
  function undo() { const p = history[history.length - 1]; if (p && !done) { d.setState(p); setHistory(history.slice(0, -1)); } }
  return (
    <div className="page" style={{ maxWidth: "28rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={d.date} path="/bean-push" />
      <h1 className="h2">Bean <em>push</em></h1>
      <p className="small muted">Push the sacks of beans 🫘 onto the marked spots in the storeroom. You can push a sack but never pull it, and only one at a time, so watch the corners. Fewest moves wins the day. Undo as often as you like.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={undo} disabled={!history.length || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setHistory([...history, s]); d.setState({ ...start(l), moves: s.moves }); }} disabled={done}>Start over</button>
        <span className="memory-stats"><span>Moves <b>{s.moves}</b></span><span>Pushes <b>{s.pushes}</b></span><span className="mm-clock">⏱ {clock(d.elapsed)}</span></span>
      </div>
      <div className={`bp-room ${done ? "done" : ""}`} style={{ ["--w" as string]: W }} role="img" aria-label={`Storeroom: ${s.boxes.filter((b) => l.goals.includes(b)).length} of ${l.goals.length} sacks on their spots`}
        onPointerDown={(e) => { swipe.current = { x: e.clientX, y: e.clientY }; }}
        onPointerUp={(e) => { const st = swipe.current; swipe.current = null; if (!st) return; const dx = e.clientX - st.x, dy = e.clientY - st.y; if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return; go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0); }}>
        {[...Array(W * H).keys()].map((i) => {
          const box = s.boxes.includes(i), goal = l.goals.includes(i);
          return <span key={i} className={`bp-sq ${l.walls[i] ? "wall" : ""} ${goal ? "goal" : ""} ${box && goal ? "home" : ""}`}>{box ? "🫘" : s.player === i ? "🧑‍🍳" : goal ? "✕" : ""}</span>;
        })}
      </div>
      <div className="tp-pad" aria-label="Move">
        {([0, 3, 2, 1] as Dir[]).map((dir) => <button key={dir} className={`btn btn-ghost btn-sm ${["up", "right", "down", "left"][dir]}`} onClick={() => go(dir)} aria-label={["Up", "Right", "Down", "Left"][dir]}>{["▲", "▶", "▼", "◀"][dir]}</button>)}
      </div>
      <p className="tiny muted center">Arrow keys, swipe, or the buttons. U undoes.</p>
      {done && <DoneCard replay={d.replay} proof={s.path} game="push" title="Bean push" date={d.date} past={past} headline={`Stored in ${s.moves} moves, ${clock(d.doneMs ?? 0)} 🎉`} score={pack(s.moves, d.doneMs ?? 0)} saved={d.saved} onSaved={(b) => { d.setBoard(b); d.setSaved(true); }} />}
      {!past && <TodayBoard board={d.board} show={(v) => `${Math.floor(v / 1_000_000)} moves · ${clock(v % 1_000_000)}`} note="Fewest moves wins; time breaks a tie." />}
    </div>
  );
}
