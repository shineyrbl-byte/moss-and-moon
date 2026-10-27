"use client";
import "./page.css";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { clock } from "@/lib/memory";
import { countsOf, isCleared, layBeans, neighbours, reveal, SWEEP_MODES, type SweepMode } from "@/lib/sweeper";
import { toDateStr } from "@/lib/cafe";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };

export default function BeanSweeper() {
  const { toast } = useStore();
  const [date, setDate] = useState("");
  const [mode, setMode] = useState<SweepMode>("easy");
  const [beans, setBeans] = useState<Set<number> | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [flags, setFlags] = useState<Set<number>>(new Set());
  const [flagMode, setFlagMode] = useState(false);
  const [boom, setBoom] = useState<number | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const { w, h, beans: total } = SWEEP_MODES[mode];
  const counts = useMemo(() => (beans ? countsOf(beans, w, h) : []), [beans, w, h]);
  useEffect(() => { setDate(toDateStr(new Date())); try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {} }, []);
  useEffect(() => {
    if (!date) return;
    fetch(`/api/daily-scores?game=sweeper&mode=${mode}&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, [date, mode]);
  useEffect(() => {
    if (!start || doneMs !== null || boom !== null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [start, doneMs, boom]);
  function reset(m = mode) { setMode(m); setBeans(null); setOpen(new Set()); setFlags(new Set()); setBoom(null); setStart(null); setDoneMs(null); setSaved(false); }

  const over = boom !== null || doneMs !== null;
  function openAt(p: number) {
    if (over || flags.has(p)) return;
    let b = beans, t = start;
    if (!b) { b = layBeans(date, mode, p); setBeans(b); t = Date.now(); setStart(t); setNow(t); }
    const c = beans ? counts : countsOf(b, w, h);
    // Tapping an opened number with the right flags around it opens the rest of its neighbours
    const targets = open.has(p) ? (c[p] > 0 && neighbours(p, w, h).filter((q) => flags.has(q)).length === c[p] ? neighbours(p, w, h).filter((q) => !flags.has(q) && !open.has(q)) : []) : [p];
    if (!targets.length) return;
    const next = new Set(open);
    for (const q of targets) {
      if (b.has(q)) { setBoom(q); setOpen(new Set([...next, q])); toast("Spilled the beans! ☕"); return; }
      for (const x of reveal(q, b, c, next, w, h)) next.add(x);
    }
    setOpen(next);
    if (isCleared(next, b, w, h)) { setDoneMs(Date.now() - (t ?? Date.now())); setFlags(new Set(b)); toast("Swept clean! 🎉"); }
  }
  function flag(p: number) {
    if (over || open.has(p) || !beans) return;
    const f = new Set(flags);
    if (f.has(p)) f.delete(p); else f.add(p);
    setFlags(f);
  }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "sweeper", mode, ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  if (!date) return <div className="page"><p className="muted">Sweeping up…</p></div>;
  const elapsed = doneMs ?? (start ? now - start : 0);
  return (
    <div className="page" style={{ maxWidth: "36rem" }}>
      <p className="eyebrow">a quick game</p>
      <h1 className="h2">Bean <em>sweeper</em></h1>
      <p className="small muted">Someone&apos;s spilled {total} coffee beans under these squares. Open every square without a bean. A number tells you how many beans touch that square. Your first tap is always safe. Flag the squares you think hide a bean (or right-click them).</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {(["easy", "hard"] as SweepMode[]).map((m) => <button key={m} className={`chip ${mode === m ? "on" : ""}`} aria-pressed={mode === m} onClick={() => reset(m)}>{m === "easy" ? "Easy" : "Hard"}</button>)}
        <span className="memory-stats"><span>⏱ {clock(elapsed)}</span><span>🫘 {total - flags.size}</span></span>
      </div>
      {!over && (
        <div className="row" style={{ gap: "0.4rem", marginTop: "0.6rem" }} role="group" aria-label="Tap to">
          <button className={`chip ${!flagMode ? "on" : ""}`} aria-pressed={!flagMode} onClick={() => setFlagMode(false)}>👆 Open</button>
          <button className={`chip ${flagMode ? "on" : ""}`} aria-pressed={flagMode} onClick={() => setFlagMode(true)}>🚩 Flag</button>
        </div>
      )}
      <div className={`bs-grid ${over ? "over" : ""}`} style={{ gridTemplateColumns: `repeat(${w}, 1fr)` }} role="group" data-grid="" aria-label={`Bean sweeper, ${w} by ${h}`}>
        {[...Array(w * h).keys()].map((p) => {
          const isOpen = open.has(p), bean = !!beans?.has(p);
          const label = isOpen ? (bean ? "bean" : counts[p] ? `${counts[p]}` : "clear") : flags.has(p) ? "flagged" : "hidden";
          return (
            <button key={p} className={`bs-cell ${isOpen ? "open" : ""} ${p === boom ? "boom" : ""} ${isOpen && !bean && counts[p] ? `n${counts[p]}` : ""}`}
              onClick={() => (flagMode && !open.has(p) ? flag(p) : openAt(p))} onContextMenu={(e) => { e.preventDefault(); flag(p); }}
              aria-label={`Row ${Math.floor(p / w) + 1}, column ${(p % w) + 1}: ${label}`}>
              <span aria-hidden="true">{isOpen ? (bean ? "🫘" : counts[p] || "") : flags.has(p) ? "🚩" : boom !== null && bean ? "🫘" : ""}</span>
            </button>
          );
        })}
      </div>
      {boom !== null && <p className="center"><button className="btn btn-pink btn-sm" onClick={() => reset()}>Try again</button></p>}
      {doneMs !== null && (
        <section className="card memory-done" aria-live="polite">
          <b>Swept clean in {clock(doneMs)} 🎉</b>
          {!saved ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓ Your best today is {clock(board?.mine?.ms ?? doneMs)}.</p>}
          <button className="btn btn-ghost btn-sm" onClick={() => reset()}>Play again</button>
        </section>
      )}
      {board && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">Today&apos;s quickest · {mode}</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{clock(t.ms)}</b></li>)}</ol> : <p className="small muted">No times yet today. Set the first one.</p>}
        </section>
      )}
    </div>
  );
}
