"use client";
import "./page.css";
import { Difficulty, Ghost } from "@/components/GameExtras";
import { showDaily } from "@/lib/scoreFormat";
import { useEffect, useMemo, useRef, useState } from "react";
import ShareResult from "@/components/ShareResult";
import ArchiveNote from "@/components/ArchiveNote";
import { dayKey, isPast, playDay } from "@/lib/archive";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { clock } from "@/lib/memory";
import { JIGSAW_MODES, photoFor, piecePos, pieceCount, trayOrder, type JigsawMode } from "@/lib/jigsaw";
import { seededRand } from "@/lib/gameOrders";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
type Item = { id: string; name: string; img: string };
const KEY = "mm-jigsaw";
const LABEL: Record<JigsawMode, string> = { small: "12 pieces", medium: "24 pieces", large: "48 pieces" };

export default function Jigsaw() {
  const { toast } = useStore();
  const [date, setDate] = useState("");
  const past = isPast(date);
  const [mode, setMode] = useState<JigsawMode>("small");
  const [item, setItem] = useState<Item | null | undefined>(undefined);
  const [placed, setPlaced] = useState<Set<number>>(new Set());
  const [held, setHeld] = useState<number | null>(null);
  const [miss, setMiss] = useState<number | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const drag = useRef<{ piece: number; el: HTMLElement; x0: number; y0: number; moved: boolean } | null>(null);
  useEffect(() => {
    const d = playDay();
    setDate(d);
    try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    fetch("/api/menu").then((r) => r.json()).then((m: { items: (Item & { pup?: boolean; cat: string })[] }) => setItem(photoFor(d, m.items.filter((x) => !x.pup)))).catch(() => setItem(null));
  }, []);
  const { cols, rows } = JIGSAW_MODES[mode], n = pieceCount(mode);
  const tray = useMemo(() => (date ? trayOrder(n, seededRand(`jigsaw-tray:${date}:${mode}`)) : []), [date, mode, n]);
  useEffect(() => {
    if (!date) return;
    let s: { date?: string; placed?: number[]; start?: number; doneMs?: number; saved?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(dayKey(`${KEY}-${mode}`)) ?? "null"); } catch {}
    const fresh = s?.date === date;
    setPlaced(new Set(fresh ? s!.placed ?? [] : [])); setStart(fresh ? s!.start ?? null : null); setNow(Date.now());
    setDoneMs(fresh ? s!.doneMs ?? null : null); setSaved(!!(fresh && s!.saved)); setHeld(null);
    fetch(`/api/daily-scores?game=jigsaw&mode=${mode}&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, [date, mode]);
  useEffect(() => { if (date) try { localStorage.setItem(dayKey(`${KEY}-${mode}`), JSON.stringify({ date, placed: [...placed], start, doneMs, saved })); } catch {} }, [date, mode, placed, start, doneMs, saved]);
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [start, doneMs]);

  const src = item ? `https://images.unsplash.com/photo-${item.img}?auto=format&fit=crop&q=75&w=720&h=${Math.round((720 * rows) / cols)}` : "";
  function drop(piece: number, slot: number) {
    if (doneMs !== null || placed.has(piece)) return;
    const t = start ?? Date.now();
    if (!start) { setStart(t); setNow(t); }
    if (piece !== slot) { setMiss(slot); setTimeout(() => setMiss(null), 400); return; }
    const next = new Set(placed).add(piece);
    setPlaced(next); setHeld(null);
    if (next.size === n) { setDoneMs(Date.now() - t); toast(`All done! It's ${item?.name} 🎉`); }
  }
  // Drag a piece from the tray, or tap it and then tap where it goes
  function down(piece: number, e: React.PointerEvent<HTMLElement>) {
    if (doneMs !== null) return;
    drag.current = { piece, el: e.currentTarget, x0: e.clientX, y0: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.moved && Math.hypot(dx, dy) < 8) return;
    d.moved = true;
    d.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.1)`; d.el.style.zIndex = "5";
  }
  function up(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    d.el.style.transform = ""; d.el.style.zIndex = "";
    if (!d.moved) { setHeld(held === d.piece ? null : d.piece); return; }
    d.el.style.visibility = "hidden";
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-slot]");
    d.el.style.visibility = "";
    if (under) drop(d.piece, Number(under.dataset.slot));
  }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "jigsaw", mode, ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  if (item === undefined || !date) return <div className="page"><p className="muted">Tipping out the pieces…</p></div>;
  if (!item) return <div className="page"><p>No jigsaw today, sorry. Our menu photos aren&apos;t loading.</p></div>;
  const elapsed = doneMs ?? (start ? now - start : 0);
  const piece = (p: number) => { const pos = piecePos(p, mode); return { backgroundImage: `url(${src})`, backgroundSize: `${cols * 100}% ${rows * 100}%`, backgroundPosition: `${pos.x}% ${pos.y}%` }; };
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={date} path="/jigsaw" />
      <h1 className="h2">Café <em>jigsaw</em></h1>
      <p className="small muted">Put today&apos;s menu photo back together. Drag a piece onto the board, or tap a piece and then tap where it goes. Pieces only stay put in the right spot.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {(Object.keys(JIGSAW_MODES) as JigsawMode[]).map((m) => <button key={m} className={`chip ${mode === m ? "on" : ""}`} aria-pressed={mode === m} onClick={() => setMode(m)}>{LABEL[m]}</button>)}
        <span className="memory-stats"><span className="mm-clock">⏱ {clock(elapsed)}</span><span>{placed.size}/{n}</span></span>
      </div>
      <Ghost elapsed={elapsed} done={doneMs !== null} />
      <div className={`jig-board ${doneMs !== null ? "done" : ""}`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, aspectRatio: `${cols} / ${rows}` }} role="grid" aria-label="Jigsaw board">
        {[...Array(n).keys()].map((s) => (
          <button key={s} data-slot={s} className={`jig-slot ${placed.has(s) ? "in" : ""} ${miss === s ? "miss" : ""}`} style={placed.has(s) ? piece(s) : undefined}
            onClick={() => held !== null && drop(held, s)} disabled={placed.has(s) || doneMs !== null} aria-label={`Space ${s + 1}${placed.has(s) ? ", filled" : ""}`} />
        ))}
      </div>
      {doneMs === null ? (
        <div className="jig-tray" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${mode === "large" ? 2.6 : 3.4}rem, 1fr))` }} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Pieces">
          {tray.filter((p) => !placed.has(p)).map((p) => (
            <button key={p} className={`jig-piece ${held === p ? "held" : ""}`} style={{ ...piece(p), aspectRatio: "1" }} onPointerDown={(e) => down(p, e)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setHeld(held === p ? null : p); } }} aria-pressed={held === p} aria-label={`Piece ${p + 1}`} />
          ))}
        </div>
      ) : (
        <section className="card memory-done" aria-live="polite">
          <b>{item.name}, done in {clock(doneMs)} 🎉</b>
          {past ? <p className="small" style={{ margin: 0 }}>Archive days and practice puzzles don&apos;t go on the board.</p> : !saved ? (
            <div className="row zen-hide" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓ Your best today is {clock(board?.mine?.ms ?? doneMs)}.</p>}
          <p className="tiny muted" style={{ margin: 0 }}>A new photo tomorrow.</p>
          <ShareResult title="Café jigsaw" date={date} score={doneMs} mode={mode} />
        </section>
      )}
      {board && !past && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3" data-zen-board="">Today&apos;s quickest · {LABEL[mode]}</h2>
          <Difficulty board={board} show={(v) => showDaily("jigsaw", v)} />
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{clock(t.ms)}</b></li>)}</ol> : <p className="small muted">No times yet today. Set the first one.</p>}
        </section>
      )}
      <p className="tiny muted">Photo from Unsplash.</p>
    </div>
  );
}
