"use client";
import "./page.css";
import { Difficulty } from "@/components/GameExtras";
import { showDaily } from "@/lib/scoreFormat";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import ArchiveNote from "@/components/ArchiveNote";
import ShareResult from "@/components/ShareResult";
import { useReplay } from "@/components/useReplay";
import { dayKey, isPast, playDay } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { OPS, apply, billFor, offBy, pack, unpack, type Op } from "@/lib/billTotal";
import { addFlag } from "@/lib/trophyFlags";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
type Tile = { id: number; v: number };
const KEY = "mm-bill";

export default function BillTotal() {
  const { toast } = useStore();
  const [date, setDate] = useState("");
  const past = isPast(date);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [steps, setSteps] = useState<string[]>([]);
  const [history, setHistory] = useState<{ tiles: Tile[]; steps: string[] }[]>([]);
  const [a, setA] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [off, setOff] = useState<number | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const bill = useMemo(() => (date ? billFor(date) : null), [date]);
  const fresh = (nums: number[]) => nums.map((v, id) => ({ id, v }));
  useEffect(() => {
    const d = playDay();
    setDate(d);
    try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    fetch(`/api/daily-scores?game=bill&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);
  useEffect(() => {
    if (!bill) return;
    let s: { date?: string; tiles?: Tile[]; steps?: string[]; start?: number; doneMs?: number; off?: number; saved?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(dayKey(KEY)) ?? "null"); } catch {}
    if (s?.date === date && s.tiles) { setTiles(s.tiles); setSteps(s.steps ?? []); setStart(s.start ?? null); setDoneMs(s.doneMs ?? null); setOff(s.off ?? null); setSaved(!!s.saved); }
    else setTiles(fresh(bill.nums));
    setNow(Date.now());
  }, [bill, date]);
  useEffect(() => { if (!rp.on && date && tiles.length) try { localStorage.setItem(dayKey(KEY), JSON.stringify({ date, tiles, steps, start, doneMs, off, saved })); } catch {} }, [date, tiles, steps, start, doneMs, off, saved]);
  const rp = useReplay({ key: dayKey(KEY), date, state: tiles, setState: setTiles, start, doneMs, first: null });
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [start, doneMs]);
  if (!bill) return <div className="page"><p className="muted">Totting up the bill…</p></div>;
  const done = doneMs !== null;
  const closest = tiles.reduce((b, t) => Math.min(b, offBy(bill.target, t.v)), Infinity);

  function finish(d: number) {
    const t = start ?? Date.now();
    setDoneMs(Date.now() - t); setOff(d); setA(null); setOp(null);
    if (d === 0) { addFlag("bill-exact"); toast(`Spot on: ${bill!.target}! 🧾🎉`); }
    else toast(`${d} off the bill. Not bad!`);
  }
  function tap(id: number) {
    if (done) return;
    if (!start) { const t = Date.now(); setStart(t); setNow(t); }
    if (a === null || op === null) { setA(a === id ? null : id); return; }
    if (id === a) { setA(null); setOp(null); return; }
    const x = tiles.find((t) => t.id === a)!, y = tiles.find((t) => t.id === id)!;
    const v = apply(x.v, op, y.v);
    if (v === null) { toast(op === "−" ? "That would go to zero or below." : "That doesn't divide exactly."); setOp(null); return; }
    const next = [...tiles.filter((t) => t.id !== a && t.id !== id), { id: Math.max(...tiles.map((t) => t.id)) + 1, v }];
    setHistory([...history, { tiles, steps }]);
    setTiles(next); setSteps([...steps, `${x.v} ${op} ${y.v} = ${v}`]); setA(null); setOp(null);
    if (v === bill!.target) finish(0);
  }
  function undo() { const p = history[history.length - 1]; if (p) { setTiles(p.tiles); setSteps(p.steps); setHistory(history.slice(0, -1)); setA(null); setOp(null); } }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "bill", ms: pack(off ?? 99, doneMs ?? 0), name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  const elapsed = doneMs ?? (start ? now - start : 0);
  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">a daily numbers game</p>
      <ArchiveNote date={date} path="/bill-total" />
      <h1 className="h2">Bill <em>total</em></h1>
      <p className="small muted">The till wants today&apos;s total. Make it from the six numbers: tap one, a sign, then another, and the answer becomes a new number to use. Each number can only be used once, and every answer has to be a whole number above zero. Hit the total exactly, or stop when you&apos;re as close as you can get.</p>
      <div className="bt-target" aria-live="polite"><small>Make</small><b>{bill.target}</b>{!done && closest > 0 && closest < 100 && tiles.length < 6 ? <small>{closest} off so far</small> : null}</div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span className="mm-clock">⏱ {clock(elapsed)}</span><span>Steps <b>{steps.length}</b></span></div>
      <div className="bt-tiles" role="group" aria-label="Your numbers">
        {tiles.map((t) => (
          <button key={t.id} className={`bt-tile ${a === t.id ? "sel" : ""} ${t.v === bill.target ? "hit" : ""} ${t.id >= 6 ? "made" : ""}`} onClick={() => tap(t.id)} disabled={done} aria-pressed={a === t.id}>{t.v}</button>
        ))}
      </div>
      <div className="bt-ops" role="group" aria-label="Signs">
        {OPS.map((o) => <button key={o} className={`btn btn-ghost ${op === o ? "on" : ""}`} onClick={() => a !== null && setOp(op === o ? null : o)} disabled={done || a === null} aria-pressed={op === o}>{o}</button>)}
      </div>
      <p className="tiny muted center">{done ? " " : a === null ? "Tap a number to start." : op === null ? "Now a sign." : "Now another number."}</p>
      <div className="row" style={{ justifyContent: "center", gap: "0.5rem" }}>
        <button className="btn btn-ghost btn-sm" onClick={undo} disabled={!history.length || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setHistory([...history, { tiles, steps }]); setTiles(fresh(bill.nums)); setSteps([]); setA(null); setOp(null); }} disabled={!steps.length || done}>Start over</button>
        <button className="btn btn-pink btn-sm" onClick={() => finish(closest)} disabled={done || closest >= 100 || closest === 0}>I&apos;m done{closest < 100 && closest > 0 ? ` (${closest} off)` : ""}</button>
      </div>
      {steps.length > 0 && <ol className="bt-steps small">{steps.map((st, k) => <li key={k}>{st}</li>)}</ol>}
      {done && (
        <section className="card memory-done" aria-live="polite">
          <b>{off === 0 ? `Spot on in ${clock(doneMs)}` : `${off} off, in ${clock(doneMs)}`} 🎉</b>
          <p className="small" style={{ margin: 0 }}>One way to make {bill.target}: {bill.way.join("; ")}.</p>
          {past ? <p className="small" style={{ margin: 0 }}>Archive days and practice puzzles don&apos;t go on the board.</p> : !saved ? (
            <div className="row zen-hide" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my score</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓</p>}
          <p className="tiny muted" style={{ margin: 0 }}>A new bill tomorrow.</p>
          <ShareResult title="Bill total" date={date} score={pack(off ?? 99, doneMs ?? 0)} replay={rp.replay} />
        </section>
      )}
      {board && !past && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3" data-zen-board="">Today&apos;s best</h2>
          <Difficulty board={board} show={(v) => showDaily("bill", v)} />
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => { const u = unpack(t.ms); return <li key={i}><span>{t.name}</span><b>{u.off ? `${u.off} off` : "spot on"} · {clock(u.ms)}</b></li>; })}</ol> : <p className="small muted">No scores yet today. Set the first one.</p>}
          <p className="tiny muted">Closest wins; time breaks a tie. Every day&apos;s total can be made exactly.</p>
        </section>
      )}
    </div>
  );
}
