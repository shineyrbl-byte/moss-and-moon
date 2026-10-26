"use client";
import { useEffect, useMemo, useState } from "react";
import ShareResult from "@/components/ShareResult";
import ArchiveNote from "@/components/ArchiveNote";
import { dayKey, isPast, playDay } from "@/lib/archive";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { clock } from "@/lib/memory";
import { SIZE, connected, count, isSolved, key, lightsFor, neighbours, toggle, type Bridges } from "@/lib/bridges";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-lights";
const pct = (x: number) => `${((x + 0.5) / SIZE) * 100}%`;

export default function StringLights() {
  const { toast } = useStore();
  const [date, setDate] = useState("");
  const past = isPast(date);
  const [br, setBr] = useState<Bridges>({});
  const [history, setHistory] = useState<Bridges[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const puzzle = useMemo(() => (date ? lightsFor(date) : null), [date]);
  useEffect(() => {
    const d = playDay();
    setDate(d);
    try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    let s: { date?: string; br?: Bridges; start?: number; doneMs?: number; saved?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(dayKey(KEY)) ?? "null"); } catch {}
    if (s?.date === d) { setBr(s.br ?? {}); setStart(s.start ?? null); setDoneMs(s.doneMs ?? null); setSaved(!!s.saved); }
    setNow(Date.now());
    fetch(`/api/daily-scores?game=lights&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  useEffect(() => { if (date) try { localStorage.setItem(dayKey(KEY), JSON.stringify({ date, br, start, doneMs, saved })); } catch {} }, [date, br, start, doneMs, saved]);
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [start, doneMs]);
  if (!puzzle) return <div className="page"><p className="muted">Untangling the lights…</p></div>;
  const { islands } = puzzle;
  const done = doneMs !== null;
  const near = sel === null ? [] : neighbours(islands, sel);

  function tap(i: number) {
    if (done) return;
    if (sel === null || sel === i) { setSel(sel === i ? null : i); return; }
    if (!near.includes(i)) { setSel(i); return; }
    const next = toggle(islands, br, sel, i);
    if (!next) { toast("That string would cross another one."); return; }
    const t = start ?? Date.now();
    if (!start) { setStart(t); setNow(t); }
    setHistory([...history, br]); setBr(next); setSel(null);
    if (isSolved(islands, next)) { setDoneMs(Date.now() - t); setSel(null); toast("All the lights are on! ✨🎉"); }
  }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "lights", ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  const elapsed = doneMs ?? (start ? now - start : 0);
  const full = islands.filter((x, i) => count(br, i) === x.n).length;
  const allFull = full === islands.length;
  return (
    <div className="page" style={{ maxWidth: "32rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={date} path="/string-lights" />
      <h1 className="h2">String <em>lights</em></h1>
      <p className="small muted">Hang the fairy lights for the terrace. Each lamp&apos;s number is how many strings it needs. Strings run straight across or down to the next lamp, there can be one or two between a pair, and they can&apos;t cross. Every lamp has to be linked to all the others.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => { const p = history[history.length - 1]; if (p) { setBr(p); setHistory(history.slice(0, -1)); } }} disabled={!history.length || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setHistory([...history, br]); setBr({}); setSel(null); }} disabled={!Object.keys(br).length || done}>Start over</button>
      </div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>✨ <b>{full}</b>/{islands.length} lamps lit</span><span>⏱ {clock(elapsed)}</span></div>
      <div className={`sl-board ${done ? "done" : ""}`} role="group" aria-label="String lights">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          {[...Array(SIZE).keys()].flatMap((r) => [...Array(SIZE).keys()].map((c) => <circle key={`${r},${c}`} cx={c + 0.5} cy={r + 0.5} r={0.04} className="sl-dot" />))}
          {Object.entries(br).map(([k, v]) => {
            const [a, b] = k.split("-").map(Number), A = islands[a], B = islands[b];
            const across = A.r === B.r, off = v === 2 ? 0.09 : 0;
            return [-off, off].slice(0, v).map((o, j) => (
              <line key={`${k}-${j}`} className="sl-string" x1={A.c + 0.5 + (across ? 0 : o)} y1={A.r + 0.5 + (across ? o : 0)} x2={B.c + 0.5 + (across ? 0 : o)} y2={B.r + 0.5 + (across ? o : 0)} />
            ));
          })}
        </svg>
        {islands.map((x, i) => {
          const n = count(br, i);
          return (
            <button key={i} className={`sl-lamp ${n === x.n ? "lit" : ""} ${n > x.n ? "over" : ""} ${sel === i ? "sel" : ""} ${near.includes(i) ? "near" : ""}`}
              style={{ left: pct(x.c), top: pct(x.r) }} onClick={() => tap(i)} disabled={done}
              aria-label={`Lamp at row ${x.r + 1}, column ${x.c + 1}: needs ${x.n}, has ${n}${sel === i ? ", selected" : near.includes(i) ? `, tap to change the strings to this lamp (now ${br[key(sel!, i)] ?? 0})` : ""}`}>
              {x.n}
            </button>
          );
        })}
      </div>
      <p className="tiny muted center">Tap a lamp, then a lamp it can reach, to hang a string. Do the same again for a second string, and a third time to take them down.</p>
      {allFull && !done && !connected(islands.length, br) && <p className="small center" role="status">Every lamp has its strings, but they aren&apos;t all linked together yet.</p>}
      {done && (
        <section className="card memory-done" aria-live="polite">
          <b>Lit up in {clock(doneMs)} 🎉</b>
          {past ? <p className="small" style={{ margin: 0 }}>Archive days don&apos;t go on the board.</p> : !saved ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓</p>}
          <p className="tiny muted" style={{ margin: 0 }}>New lights tomorrow.</p>
          <ShareResult title="String lights" date={date} />
        </section>
      )}
      {board && !past && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">Today&apos;s quickest</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{clock(t.ms)}</b></li>)}</ol> : <p className="small muted">No times yet today. Set the first one.</p>}
        </section>
      )}
    </div>
  );
}
