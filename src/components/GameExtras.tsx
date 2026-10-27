"use client";
import { useEffect, useState } from "react";
import { clock } from "@/lib/memory";

// Bests are kept by page, so one helper serves every puzzle
const bestKey = (path: string) => `mm-best-${path}`;
/** Remember your quickest time on this page's puzzle (for the ghost) */
export function rememberBest(path: string, ms: number) {
  try { const b = Number(localStorage.getItem(bestKey(path))) || 0; if (!b || ms < b) localStorage.setItem(bestKey(path), String(Math.round(ms))); } catch {}
}
/** Race your ghost: how you're doing against your own best time on this puzzle */
export function Ghost({ elapsed, done }: { elapsed: number; done: boolean }) {
  const [best, setBest] = useState(0);
  useEffect(() => { try { setBest(Number(localStorage.getItem(bestKey(location.pathname))) || 0); } catch {} }, []);
  if (!best || done || !elapsed) return null;
  const f = Math.min(1, elapsed / best), ahead = elapsed < best;
  return (
    <div className="ghost-bar mm-clock" role="status" aria-label={`Your best is ${clock(best)}. ${ahead ? `${clock(best - elapsed)} left to beat it` : `${clock(elapsed - best)} over`}`}>
      <span className="ghost-track"><i style={{ width: `${f * 100}%` }} /><b aria-hidden="true" style={{ left: `${f * 100}%` }}>👻</b></span>
      <span className="tiny muted">{ahead ? `👻 Your best ${clock(best)}: ${clock(best - elapsed)} to go` : `👻 Past your best (${clock(best)})`}</span>
    </div>
  );
}
/** Today's difficulty: the day's typical time against the last fortnight's */
export function Difficulty({ board, show }: { board: { played?: number; median?: number | null; usual?: number | null } | null; show: (v: number) => string }) {
  if (!board?.median || !board.played || board.played < 3) return null;
  const r = board.usual ? board.median / board.usual : 1;
  const word = !board.usual ? "" : r < 0.8 ? " · quicker than usual 🟢" : r > 1.25 ? " · tougher than usual 🔴" : " · about usual 🟡";
  return <p className="tiny muted" style={{ margin: "0.2rem 0 0.4rem" }}>Today: {board.played} played, typical {show(board.median)}{word}</p>;
}
