"use client";
import "./page.css";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { FLAVOURS, START_W, WIDTH, drop, slide, speedFor, type Layer } from "@/lib/stacker";

type Board = { top: { name: string; score: number }[]; mine: number | null; best: number | null };
type Crumb = { id: number; x: number; w: number; level: number; colour: string };
const BEST = "mm-stacker-best";
const H = 22; // px per layer
const BASE: Layer = { x: (WIDTH - START_W) / 2, w: START_W };

export default function CakeStacker() {
  const { toast } = useStore();
  const [stack, setStack] = useState<Layer[]>([BASE]);
  const [mover, setMover] = useState<{ x: number; dir: 1 | -1 }>({ x: 0, dir: 1 });
  const [playing, setPlaying] = useState(false);
  const [over, setOver] = useState(false);
  const [perfects, setPerfects] = useState(0);
  const [flash, setFlash] = useState(false);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [best, setBest] = useState(0);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const moverRef = useRef(mover);
  moverRef.current = mover;
  const score = stack.length - 1;
  const top = stack[stack.length - 1];
  useEffect(() => {
    try { setBest(Number(localStorage.getItem(BEST)) || 0); setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    fetch(`/api/arcade?game=stacker&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  // Slide the layer back and forth. Frames are capped so a hidden tab just pauses.
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      setMover((m) => slide(m.x, m.dir, top.w, speedFor(score), dt));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, top.w, score]);

  function begin() {
    setStack([BASE]); setMover({ x: 0, dir: 1 }); setOver(false); setPerfects(0); setCrumbs([]); setSaved(false); setPlaying(true);
  }
  function tap() {
    if (!playing) return;
    const cur = { x: moverRef.current.x, w: top.w };
    const placed = drop(top, cur);
    const level = stack.length, colour = FLAVOURS[level % FLAVOURS.length];
    if (!placed) {
      setCrumbs((c) => [...c.slice(-6), { id: Date.now(), x: cur.x, w: cur.w, level, colour }]);
      setPlaying(false); setOver(true);
      if (score > best) { setBest(score); try { localStorage.setItem(BEST, String(score)); } catch {} if (score) toast(`New best: ${score} layers! 🎂`); }
      return;
    }
    if (placed.cut > 0) {
      const cutX = cur.x < placed.x ? cur.x : placed.x + placed.w;
      setCrumbs((c) => [...c.slice(-6), { id: Date.now(), x: cutX, w: placed.cut, level, colour }]);
    }
    if (placed.perfect) { setPerfects(perfects + 1); setFlash(true); setTimeout(() => setFlash(false), 450); } else setPerfects(0);
    setStack([...stack, { x: placed.x, w: placed.w }]);
    // The next layer comes in from whichever side is further away
    setMover({ x: placed.x > (WIDTH - placed.w) / 2 ? 0 : WIDTH - placed.w, dir: placed.x > (WIDTH - placed.w) / 2 ? 1 : -1 });
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.key === " " || e.key === "Enter") && (e.target as HTMLElement).tagName !== "INPUT" && (e.target as HTMLElement).tagName !== "BUTTON") {
        e.preventDefault();
        if (playing) tap(); else begin();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/arcade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "stacker", score, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  // Keep the top of the cake in view as it grows
  const lift = Math.max(0, (stack.length + 2) * H - 260);
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">an arcade game</p>
      <h1 className="h2">Cake <em>stacker</em></h1>
      <p className="small muted">A layer slides across. Tap (or press space) to drop it on the cake. Anything hanging over the edge gets trimmed off, so the layers get narrower, and faster. Drop one right on top for a perfect layer, which gives back a little width.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}>
        <span>Layers <b>{score}</b></span>{perfects > 1 && <span>✨ {perfects} perfect in a row</span>}<span>Best <b>{best}</b></span>
      </div>
      <div className={`stacker ${flash ? "perfect" : ""}`} onPointerDown={(e) => { if (playing) { e.preventDefault(); tap(); } }} role="application" aria-label={`Cake stacker, ${score} layers`}>
        <div className="stacker-world" style={{ transform: `translateY(${lift}px)` }}>
          <span className="stacker-plate" />
          {stack.map((l, i) => (
            <span key={i} className={`stacker-layer ${i === 0 ? "base" : ""}`} style={{ left: `${l.x}%`, width: `${l.w}%`, bottom: 14 + i * H, background: i === 0 ? undefined : FLAVOURS[i % FLAVOURS.length] }} />
          ))}
          {playing && <span className="stacker-layer moving" style={{ left: `${mover.x}%`, width: `${top.w}%`, bottom: 14 + stack.length * H, background: FLAVOURS[stack.length % FLAVOURS.length] }} />}
          {crumbs.map((c) => <span key={c.id} className="stacker-layer crumb" style={{ left: `${c.x}%`, width: `${c.w}%`, bottom: 14 + c.level * H, background: c.colour }} />)}
        </div>
        {!playing && (
          <div className="stacker-over">
            {over ? <><b>The cake toppled! {score} layer{score === 1 ? "" : "s"}</b><button className="btn btn-pink btn-sm" onClick={begin}>Bake another</button></>
              : <button className="btn btn-pink" onClick={begin}>▶ Start stacking</button>}
          </div>
        )}
      </div>
      {over && score > 0 && !saved && (
        <div className="row" style={{ justifyContent: "center", alignItems: "end", gap: "0.5rem", marginTop: "0.8rem" }}>
          <label className="field" style={{ maxWidth: "12rem", marginBottom: 0 }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
          <button className="btn btn-pink btn-sm" onClick={save}>Save score</button>
        </div>
      )}
      {saved && <p className="small center">Saved ✓</p>}
      {board && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">This week&apos;s tallest</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{t.score}</b></li>)}</ol> : <p className="small muted">No cakes yet this week. Bake the first one.</p>}
          <p className="tiny muted">The board starts fresh every Monday.</p>
        </section>
      )}
    </div>
  );
}
