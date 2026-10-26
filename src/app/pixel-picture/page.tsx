"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import ArchiveNote from "@/components/ArchiveNote";
import { dayKey, isPast, playDay } from "@/lib/archive";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { clock } from "@/lib/memory";
import { isSolved, lineDone, nonogramFor, type NonoMode } from "@/lib/nonogram";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-nonogram";
// 0 = blank, 1 = shaded, 2 = crossed out (a note to yourself)

export default function PixelPicture() {
  const { toast } = useStore();
  const [date, setDate] = useState("");
  const past = isPast(date);
  const [mode, setMode] = useState<NonoMode>("easy");
  const [cells, setCells] = useState<number[]>([]);
  const [tool, setTool] = useState<1 | 2>(1);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const paint = useRef<number | null>(null);
  useEffect(() => { setDate(playDay()); try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {} }, []);
  const pic = useMemo(() => (date ? nonogramFor(date, mode) : null), [date, mode]);
  const n = pic?.size ?? 5;
  useEffect(() => {
    if (!pic) return;
    let s: { date?: string; cells?: number[]; start?: number; doneMs?: number; saved?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(dayKey(`${KEY}-${mode}`)) ?? "null"); } catch {}
    const fresh = s?.date === date && s.cells?.length === pic.size * pic.size;
    setCells(fresh ? s!.cells! : Array(pic.size * pic.size).fill(0));
    setStart(fresh ? s!.start ?? null : null); setNow(Date.now());
    setDoneMs(fresh ? s!.doneMs ?? null : null); setSaved(!!(fresh && s!.saved));
    fetch(`/api/daily-scores?game=nonogram&mode=${mode}&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, [pic, mode, date]);
  useEffect(() => { if (date && cells.length) try { localStorage.setItem(dayKey(`${KEY}-${mode}`), JSON.stringify({ date, cells, start, doneMs, saved })); } catch {} }, [date, mode, cells, start, doneMs, saved]);
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [start, doneMs]);
  useEffect(() => { const up = () => (paint.current = null); window.addEventListener("pointerup", up); return () => window.removeEventListener("pointerup", up); }, []);

  function set(p: number, v: number) {
    if (!pic || doneMs !== null) return;
    if (!start) { const t = Date.now(); setStart(t); setNow(t); }
    setCells((cur) => (cur[p] === v ? cur : cur.map((x, i) => (i === p ? v : x))));
  }
  // Finished once the shaded squares match every clue
  useEffect(() => {
    if (!pic || doneMs !== null || !start || cells.length !== pic.size * pic.size) return;
    if (isSolved(cells.map((x) => x === 1), pic.clues)) { setDoneMs(Date.now() - start); toast(`It's ${pic.name}! 🎉`); }
  }, [cells]); // eslint-disable-line react-hooks/exhaustive-deps
  function down(p: number, e: React.PointerEvent) {
    e.preventDefault();
    const v = cells[p] === tool ? 0 : tool;
    paint.current = v; set(p, v);
  }
  function move(e: React.PointerEvent) {
    if (paint.current === null) return;
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const p = el?.closest<HTMLElement>("[data-p]")?.dataset.p;
    if (p !== undefined) set(Number(p), paint.current);
  }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "nonogram", mode, ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  if (!pic || cells.length !== n * n) return <div className="page"><p className="muted">Mixing the paints…</p></div>;
  const elapsed = doneMs ?? (start ? now - start : 0);
  const row = (r: number) => cells.slice(r * n, r * n + n).map((x) => x === 1);
  const col = (c: number) => [...Array(n).keys()].map((r) => cells[r * n + c] === 1);
  return (
    <div className="page" style={{ maxWidth: "38rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={date} path="/pixel-picture" />
      <h1 className="h2">Pixel <em>picture</em></h1>
      <p className="small muted">The numbers say how many squares in a row are shaded, in order, with at least one gap between each group. Shade them all to reveal today&apos;s picture. You can drag across squares, and ✕ marks squares you know are empty.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {(["easy", "hard"] as NonoMode[]).map((m) => <button key={m} className={`chip ${mode === m ? "on" : ""}`} aria-pressed={mode === m} onClick={() => setMode(m)}>{m === "easy" ? "Easy 5×5" : "Hard 10×10"}</button>)}
        <span className="memory-stats"><span>⏱ {clock(elapsed)}</span></span>
      </div>
      {doneMs === null && (
        <div className="row" style={{ gap: "0.4rem", marginTop: "0.6rem" }} role="group" aria-label="Tool">
          <button className={`chip ${tool === 1 ? "on" : ""}`} aria-pressed={tool === 1} onClick={() => setTool(1)}>⬛ Shade</button>
          <button className={`chip ${tool === 2 ? "on" : ""}`} aria-pressed={tool === 2} onClick={() => setTool(2)}>✕ Mark empty</button>
        </div>
      )}
      <div className={`nono ${mode} ${doneMs !== null ? "done" : ""}`} style={{ "--n": n } as React.CSSProperties}>
        <span className="nono-corner" aria-hidden="true" />
        <div className="nono-cols" aria-hidden="true">
          {pic.clues.cols.map((c, i) => <span key={i} className={lineDone(col(i), c) ? "ok" : ""}>{c.map((x, k) => <b key={k}>{x}</b>)}</span>)}
        </div>
        <div className="nono-rows" aria-hidden="true">
          {pic.clues.rows.map((c, i) => <span key={i} className={lineDone(row(i), c) ? "ok" : ""}>{c.join(" ")}</span>)}
        </div>
        <div className="nono-grid" role="grid" aria-label={`Pixel picture, ${n} by ${n}`} onPointerMove={move}>
          {cells.map((v, p) => (
            <button key={p} data-p={p} className={`nono-cell ${v === 1 ? "on" : v === 2 ? "x" : ""} ${p % n === 4 && n === 10 ? "edge-r" : ""} ${Math.floor(p / n) === 4 && n === 10 ? "edge-b" : ""}`}
              onPointerDown={(e) => down(p, e)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); set(p, cells[p] === tool ? 0 : tool); } }}
              aria-label={`Row ${Math.floor(p / n) + 1} (clue ${pic.clues.rows[Math.floor(p / n)].join(" ")}), column ${(p % n) + 1} (clue ${pic.clues.cols[p % n].join(" ")}): ${v === 1 ? "shaded" : v === 2 ? "marked empty" : "blank"}`}>
              {v === 2 && <span aria-hidden="true">✕</span>}
            </button>
          ))}
        </div>
      </div>
      {doneMs === null && cells.some(Boolean) && <p className="center"><button className="btn btn-ghost btn-sm" onClick={() => setCells(Array(n * n).fill(0))}>Start again</button></p>}
      {doneMs !== null && (
        <section className="card memory-done" aria-live="polite">
          <b>It&apos;s {pic.name}! Solved in {clock(doneMs)} 🎉</b>
          {past ? <p className="small" style={{ margin: 0 }}>Archive days don&apos;t go on the board.</p> : !saved ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓ Your best today is {clock(board?.mine?.ms ?? doneMs)}.</p>}
          <p className="tiny muted" style={{ margin: 0 }}>A new picture tomorrow{mode === "easy" ? ". Fancy the 10×10?" : "."}</p>
        </section>
      )}
      {board && !past && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">Today&apos;s quickest · {mode}</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{clock(t.ms)}</b></li>)}</ol> : <p className="small muted">No times yet today. Set the first one.</p>}
        </section>
      )}
    </div>
  );
}
