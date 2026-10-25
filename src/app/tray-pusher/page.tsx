"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import { LEVELS, move, parse, solved, type Dir, type Pos } from "@/lib/sokoban";
import { addFlag } from "@/lib/trophyFlags";

const KEY = "mm-tray";
const KEYS: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };

export default function TrayPusher() {
  const { toast } = useStore();
  const [at, setAt] = useState(0);
  const [best, setBest] = useState<Record<number, number>>({});
  const [pos, setPos] = useState<Pos>(() => parse(LEVELS[0].map));
  const [history, setHistory] = useState<Pos[]>([]);
  const [won, setWon] = useState(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const level = LEVELS[at];
  const rows = level.map.length;
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (v) { setBest(v.best ?? {}); const a = Math.min(Math.max(0, v.at ?? 0), LEVELS.length - 1); setAt(a); setPos(parse(LEVELS[a].map)); }
    } catch {}
  }, []);
  function store(b: Record<number, number>, a: number) { try { localStorage.setItem(KEY, JSON.stringify({ best: b, at: a })); } catch {} }
  function go(a: number) { setAt(a); setPos(parse(LEVELS[a].map)); setHistory([]); setWon(false); store(best, a); }

  function step(d: Dir) {
    if (won) return;
    const m = move(pos, d);
    if (!m) return;
    setHistory([...history, pos]); setPos(m.pos);
    if (m.pushed && solved(m.pos)) {
      const n = history.length + 1;
      setWon(true);
      const b = { ...best, [at]: Math.min(best[at] ?? Infinity, n) };
      setBest(b); store(b, at);
      if (n <= level.fewest) addFlag("tray-fewest");
      toast(n <= level.fewest ? `Every cup on a saucer, in the fewest steps! ✨` : `Every cup on a saucer in ${n} steps! ☕🎉`);
    }
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement).tagName;
      if (t === "INPUT" || t === "SELECT" || e.metaKey || e.ctrlKey) return;
      const d = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
      if (d) { e.preventDefault(); step(d); }
      else if (e.key === "z" || e.key === "u") undo();
      else if (e.key === "r") restart();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  function undo() { const p = history[history.length - 1]; if (p && !won) { setPos(p); setHistory(history.slice(0, -1)); } }
  function restart() { setPos(parse(level.map)); setHistory([]); setWon(false); }
  const cells = useMemo(() => [...Array(rows * pos.w).keys()], [rows, pos.w]);
  const onSaucer = pos.cups.filter((c) => pos.goals.has(c)).length;
  const solvedCount = Object.keys(best).length;
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">a puzzle pack</p>
      <h1 className="h2">Tray <em>pusher</em></h1>
      <p className="small muted">Push every cup onto a saucer. Walk with the arrow keys, by swiping on the board, or with the buttons. You can push a cup but never pull one, and only one at a time, so a cup pushed into a corner is stuck.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <label className="field" style={{ marginBottom: 0 }}><span className="sr-only">Level</span>
          <select className="input" value={at} onChange={(e) => go(Number(e.target.value))}>
            {LEVELS.map((l, i) => <option key={i} value={i}>{i + 1}. {l.name}{best[i] !== undefined ? " ✓" : ""}</option>)}
          </select>
        </label>
        <button className="btn btn-ghost btn-sm" onClick={undo} disabled={!history.length || won}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={restart} disabled={!history.length}>Restart</button>
      </div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}>
        <span>Steps <b>{history.length}</b></span><span>☕ <b>{onSaucer}</b>/{pos.cups.length} on saucers</span>{best[at] !== undefined && <span>Your best <b>{best[at]}</b></span>}
      </div>
      <div className={`tp-board ${won ? "won" : ""}`} style={{ ["--w" as string]: pos.w, ["--h" as string]: rows }} role="application" aria-label={`Level ${at + 1}, ${level.name}. ${onSaucer} of ${pos.cups.length} cups on saucers.`}
        onPointerDown={(e) => { swipe.current = { x: e.clientX, y: e.clientY }; }}
        onPointerUp={(e) => {
          const s = swipe.current; swipe.current = null;
          if (!s) return;
          const dx = e.clientX - s.x, dy = e.clientY - s.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
          step(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
        }}>
        {cells.map((i) => {
          const wall = pos.walls.has(i), goal = pos.goals.has(i), cup = pos.cups.includes(i), me = pos.me === i;
          return (
            <span key={i} className={`tp-cell ${wall ? "tp-wall" : "tp-floor"} ${goal ? "tp-goal" : ""}`} aria-hidden="true">
              {cup && <i className={`tp-cup ${goal ? "home" : ""}`}>☕</i>}
              {me && <i className="tp-me">🧑‍🍳</i>}
            </span>
          );
        })}
      </div>
      <div className="tp-pad" aria-label="Move">
        <button className="btn btn-ghost btn-sm up" onClick={() => step("up")} aria-label="Up">▲</button>
        <button className="btn btn-ghost btn-sm left" onClick={() => step("left")} aria-label="Left">◀</button>
        <button className="btn btn-ghost btn-sm down" onClick={() => step("down")} aria-label="Down">▼</button>
        <button className="btn btn-ghost btn-sm right" onClick={() => step("right")} aria-label="Right">▶</button>
      </div>
      {won && (
        <section className="card memory-done" aria-live="polite">
          <b>Done in {history.length} steps{history.length <= level.fewest ? ", the fewest possible" : ""} 🎉</b>
          <p className="small" style={{ margin: 0 }}>The fewest it can be done in is {level.fewest}.</p>
          {at < LEVELS.length - 1 ? <button className="btn btn-pink btn-sm" onClick={() => go(at + 1)}>Next level →</button> : <p className="small" style={{ margin: 0 }}>That was the last level. 🏆</p>}
        </section>
      )}
      <p className="small muted" style={{ marginTop: "1rem" }}>{solvedCount} of {LEVELS.length} levels done. Fewest possible for this one: {level.fewest} steps.</p>
      <p className="tiny muted">Keys: arrows or WASD to walk, Z to undo, R to restart. Your progress is kept on this device.</p>
    </div>
  );
}
