"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import { EXIT_ROW, LEVELS, N, isOut, parse, range, slide, type Piece } from "@/lib/rushHour";
import { addFlag } from "@/lib/trophyFlags";

const KEY = "mm-jam";
type Snap = { ps: Piece[]; moves: number; last: string | null };
const fresh = (i: number): Snap => ({ ps: parse(LEVELS[i].board), moves: 0, last: null });
type Drag = { i: number; start: number; cell: number; lo: number; hi: number; off: number };

export default function DeliveryJam() {
  const { toast } = useStore();
  const [at, setAt] = useState(0);
  const [best, setBest] = useState<Record<number, number>>({});
  const [g, setG] = useState<Snap>(() => fresh(0));
  const [history, setHistory] = useState<Snap[]>([]);
  const [won, setWon] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const level = LEVELS[at];
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (v) { setBest(v.best ?? {}); const a = Math.min(Math.max(0, v.at ?? 0), LEVELS.length - 1); setAt(a); setG(fresh(a)); }
    } catch {}
  }, []);
  function store(b: Record<number, number>, a: number) { try { localStorage.setItem(KEY, JSON.stringify({ best: b, at: a })); } catch {} }
  function go(a: number) { setAt(a); setG(fresh(a)); setHistory([]); setWon(false); store(best, a); }

  /** Slide a crate. Moving the same crate again straight after counts as the same move. */
  function commit(i: number, by: number) {
    if (won || !by) return;
    const ps = slide(g.ps, i, by);
    if (!ps) return;
    const id = g.ps[i].id;
    const next = { ps, moves: g.last === id ? g.moves : g.moves + 1, last: id };
    setHistory([...history, g]); setG(next);
    if (isOut(ps)) {
      setWon(true);
      const b = { ...best, [at]: Math.min(best[at] ?? Infinity, next.moves) };
      setBest(b); store(b, at);
      if (next.moves <= level.fewest) addFlag("jam-fewest");
      toast(next.moves <= level.fewest ? "The cakes are on their way, in the fewest moves! ✨" : `The cakes are on their way! ${next.moves} moves 🚐🎉`);
    }
  }
  function down(e: React.PointerEvent, i: number) {
    if (won) return;
    const box = boardRef.current?.getBoundingClientRect();
    if (!box) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const [lo, hi] = range(g.ps, i);
    setDrag({ i, start: g.ps[i].across ? e.clientX : e.clientY, cell: box.width / N, lo, hi, off: 0 });
  }
  function moveP(e: React.PointerEvent) {
    if (!drag) return;
    const p = g.ps[drag.i];
    const d = ((p.across ? e.clientX : e.clientY) - drag.start) / drag.cell;
    setDrag({ ...drag, off: Math.max(drag.lo, Math.min(drag.hi, d)) });
  }
  function up() {
    if (!drag) return;
    const by = Math.round(drag.off);
    setDrag(null);
    commit(drag.i, by);
  }
  function key(e: React.KeyboardEvent, i: number) {
    const p = g.ps[i];
    const by = p.across ? (e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0) : e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (by) { e.preventDefault(); commit(i, by); }
  }
  function undo() { const p = history[history.length - 1]; if (p && !won) { setG(p); setHistory(history.slice(0, -1)); } }
  const solvedCount = Object.keys(best).length;
  return (
    <div className="page" style={{ maxWidth: "32rem" }}>
      <p className="eyebrow">a puzzle pack</p>
      <h1 className="h2">Delivery <em>jam</em></h1>
      <p className="small muted">The cake van 🚐 is boxed in by crates in the yard. Slide the crates out of the way (each only along its length) and drive the van out through the gap on the right. Drag a crate, or tap it and use the arrow keys.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <label className="field" style={{ marginBottom: 0 }}><span className="sr-only">Level</span>
          <select className="input" value={at} onChange={(e) => go(Number(e.target.value))}>
            {LEVELS.map((l, i) => <option key={i} value={i}>Level {i + 1} · {l.fewest} moves{best[i] !== undefined ? " ✓" : ""}</option>)}
          </select>
        </label>
        <button className="btn btn-ghost btn-sm" onClick={undo} disabled={!history.length || won}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => go(at)} disabled={!history.length}>Restart</button>
      </div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}>
        <span>Moves <b>{g.moves}</b></span><span>Fewest <b>{level.fewest}</b></span>{best[at] !== undefined && <span>Your best <b>{best[at]}</b></span>}
      </div>
      <div className={`dj-wrap ${won ? "won" : ""}`}>
        <div className="dj-board" ref={boardRef} role="group" aria-label={`Level ${at + 1}`} onPointerMove={moveP} onPointerUp={up} onPointerCancel={up}>
          {[...Array(N * N).keys()].map((k) => <span key={k} className="dj-cell" aria-hidden="true" />)}
          {g.ps.map((p, i) => {
            const off = drag?.i === i ? drag.off : 0;
            const isVan = p.id === "A";
            const style = {
              left: `${(p.c / N) * 100}%`, top: `${(p.r / N) * 100}%`,
              width: `${((p.across ? p.len : 1) / N) * 100}%`, height: `${((p.across ? 1 : p.len) / N) * 100}%`,
              transform: `translate(${p.across ? off * 100 / p.len : 0}%, ${p.across ? 0 : off * 100 / p.len}%)`,
            };
            return (
              <button key={p.id} className={`dj-piece ${isVan ? "van" : p.len === 3 ? "long" : ""} ${p.across ? "across" : "down"} ${drag?.i === i ? "drag" : ""}`} style={style}
                onPointerDown={(e) => down(e, i)} onKeyDown={(e) => key(e, i)} disabled={won}
                aria-label={`${isVan ? "Cake van" : `${p.len === 3 ? "Long crate" : "Crate"} ${p.id}`}, ${p.across ? "slides left and right" : "slides up and down"}, at row ${p.r + 1}, column ${p.c + 1}`}>
                {isVan ? <span aria-hidden="true">🚐</span> : <span aria-hidden="true" className="dj-slats" />}
              </button>
            );
          })}
        </div>
        <span className="dj-exit" style={{ top: `${(EXIT_ROW / N) * 100}%`, height: `${100 / N}%` }} aria-hidden="true">→</span>
      </div>
      {won && (
        <section className="card memory-done" aria-live="polite">
          <b>Out in {g.moves} moves{g.moves <= level.fewest ? ", the fewest possible" : ""} 🎉</b>
          {at < LEVELS.length - 1 ? <button className="btn btn-pink btn-sm" onClick={() => go(at + 1)}>Next level →</button> : <p className="small" style={{ margin: 0 }}>That was the last level. 🏆</p>}
        </section>
      )}
      <p className="small muted" style={{ marginTop: "1rem" }}>{solvedCount} of {LEVELS.length} levels done. A move is one crate sliding any distance.</p>
      <p className="tiny muted">The levels get harder as you go: the last one takes {LEVELS[LEVELS.length - 1].fewest} moves at the very least. Your progress is kept on this device.</p>
    </div>
  );
}
