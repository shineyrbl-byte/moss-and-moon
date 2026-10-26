"use client";
import "./page.css";
import { useEffect, useMemo, useState } from "react";
import ShareResult from "@/components/ShareResult";
import { useReplay } from "@/components/useReplay";
import ArchiveNote from "@/components/ArchiveNote";
import { dayKey, isPast, playDay } from "@/lib/archive";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { clock } from "@/lib/memory";
import { COLS, DIFFS, MISS_MS, ROWS, TIME_MS, hitDiff, sceneFor, type Item, type Scene } from "@/lib/spotDiff";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-spot";

function Picture({ items, scene, found, reveal, onTap, label }: { items: Item[]; scene: Scene; found: number[]; reveal: boolean; onTap: (e: React.MouseEvent<HTMLDivElement>) => void; label: string }) {
  return (
    <div className="spot-pic" onClick={onTap} role="img" aria-label={label} style={{ ["--cols" as string]: COLS, ["--rows" as string]: ROWS }}>
      <span className="spot-shelf" style={{ top: "38%" }} aria-hidden="true" />
      <span className="spot-shelf" style={{ top: "78%" }} aria-hidden="true" />
      {items.map((it) => (
        <span key={it.cell} className="spot-item" aria-hidden="true" style={{
          left: `${((it.cell % COLS) + 0.5 + it.dx) / COLS * 100}%`, top: `${(Math.floor(it.cell / COLS) + 0.5 + it.dy) / ROWS * 100}%`,
          transform: `translate(-50%, -50%) rotate(${it.rot}deg) scale(${it.size})`, filter: it.hue ? `hue-rotate(${it.hue}deg) saturate(1.4)` : undefined,
        }}>{it.emoji}</span>
      ))}
      {scene.diffs.map((d, i) => (found.includes(i) || reveal) && (
        <span key={i} className={`spot-ring ${found.includes(i) ? "" : "missed"}`} aria-hidden="true"
          style={{ left: `${((d.cell % COLS) + 0.5) / COLS * 100}%`, top: `${(Math.floor(d.cell / COLS) + 0.5) / ROWS * 100}%` }} />
      ))}
    </div>
  );
}

export default function SpotTheDifference() {
  const { toast } = useStore();
  const [date, setDate] = useState("");
  const past = isPast(date);
  const [found, setFound] = useState<number[]>([]);
  const [start, setStart] = useState<number | null>(null);
  const [penalty, setPenalty] = useState(0);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const [flash, setFlash] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const d = playDay();
    setDate(d);
    try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    let s: { date?: string; found?: number[]; start?: number; penalty?: number; doneMs?: number; timeUp?: boolean; saved?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(dayKey(KEY)) ?? "null"); } catch {}
    if (s?.date === d) { setFound(s.found ?? []); setStart(s.start ?? null); setPenalty(s.penalty ?? 0); setDoneMs(s.doneMs ?? null); setTimeUp(!!s.timeUp); setSaved(!!s.saved); }
    setNow(Date.now());
    fetch(`/api/daily-scores?game=spot&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  const scene = useMemo(() => (date ? sceneFor(date) : null), [date]);
  useEffect(() => { if (!rp.on && date) try { localStorage.setItem(dayKey(KEY), JSON.stringify({ date, found, start, penalty, doneMs, timeUp, saved })); } catch {} }, [date, found, start, penalty, doneMs, timeUp, saved]);
  const rp = useReplay({ key: dayKey(KEY), date, state: found, setState: setFound, start, doneMs, first: null });
  const used = start ? now - start + penalty : 0;
  const over = doneMs !== null || timeUp;
  useEffect(() => {
    if (!start || over) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [start, over]);
  useEffect(() => { if (start && !over && used >= TIME_MS) { setTimeUp(true); toast("Time's up! The rings show what you missed."); } }, [used, start, over, toast]);
  if (!scene) return <div className="page"><p className="muted">Arranging the shelves…</p></div>;

  function tap(e: React.MouseEvent<HTMLDivElement>) {
    if (over || !scene) return;
    const r = e.currentTarget.getBoundingClientRect();
    const t = start ?? Date.now();
    if (!start) { setStart(t); setNow(t); }
    const hit = hitDiff(scene, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, found);
    if (hit < 0) { setPenalty(penalty + MISS_MS); setFlash(true); setTimeout(() => setFlash(false), 300); return; }
    const next = [...found, hit];
    setFound(next);
    if (next.length === DIFFS) { setDoneMs(Date.now() - t + penalty); toast("All five spotted! 🔍🎉"); }
  }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "spot", ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  const left = Math.max(0, TIME_MS - used);
  return (
    <div className="page" style={{ maxWidth: "52rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={date} path="/spot-the-difference" />
      <h1 className="h2">Spot the <em>difference</em></h1>
      <p className="small muted">Five things changed between the two shelves. Tap them on either picture. You have two minutes, and each wrong tap costs {MISS_MS / 1000} seconds. The clock starts on your first tap.</p>
      <div className="row" style={{ alignItems: "center" }}>
        <span className="memory-stats"><span className={flash ? "spot-flash" : ""}>⏱ {clock(left)} left</span><span>{found.length}/{DIFFS} found</span></span>
      </div>
      <div className={`spot-pair ${flash ? "miss" : ""}`}>
        <Picture items={scene.left} scene={scene} found={found} reveal={timeUp} onTap={tap} label="The first shelf" />
        <Picture items={scene.right} scene={scene} found={found} reveal={timeUp} onTap={tap} label="The second shelf, with five changes" />
      </div>
      {doneMs !== null && (
        <section className="card memory-done" aria-live="polite">
          <b>All five in {clock(doneMs)} 🎉</b>
          {past ? <p className="small" style={{ margin: 0 }}>Archive days and practice puzzles don&apos;t go on the board.</p> : !saved ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓</p>}
          <ShareResult title="Spot the difference" date={date} score={doneMs} replay={rp.replay} />
        </section>
      )}
      {timeUp && <p className="small center">You found {found.length} of {DIFFS}. New shelves tomorrow!</p>}
      {board && !past && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">Today&apos;s quickest</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{clock(t.ms)}</b></li>)}</ol> : <p className="small muted">No times yet today. Set the first one.</p>}
        </section>
      )}
    </div>
  );
}
