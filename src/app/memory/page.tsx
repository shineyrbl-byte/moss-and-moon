"use client";
import "./page.css";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { clock, deal, MEMORY_MODES, pickItems, type MemoryMode } from "@/lib/memory";
import { itemName, photo, type MenuItem } from "@/lib/menu";
import { toDateStr } from "@/lib/cafe";

type Board = { top: { name: string; ms: number; moves: number }[]; mine: { ms: number; moves: number } | null };

export default function Memory() {
  const { menu, lang, toast } = useStore();
  const [mode, setMode] = useState<MemoryMode>("full");
  const [date, setDate] = useState("");
  const [cards, setCards] = useState<{ key: number; item: MenuItem }[]>([]);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const lock = useRef(false);

  // One item per photo, so two cards never look alike without matching
  const pool = useMemo(() => {
    const seen = new Set<string>();
    return menu.filter((m) => ["coffee", "tea", "cold", "bakes"].includes(m.cat) && !m.pup && !m.groups?.length && !seen.has(m.img) && !!seen.add(m.img));
  }, [menu]);
  const loadBoard = useCallback((m: MemoryMode) => fetch(`/api/memory?mode=${m}&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {}), []);
  const newGame = useCallback((m: MemoryMode) => {
    const d = toDateStr(new Date());
    setDate(d);
    setCards(deal(pickItems(pool, d, m)));
    setOpen([]); setMatched(new Set()); setMoves(0); setStart(null); setDoneMs(null); setSaved(false);
    lock.current = false;
    loadBoard(m);
  }, [pool, loadBoard]);
  useEffect(() => { if (pool.length >= 8) newGame(mode); }, [pool.length >= 8, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {} }, []);
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [start, doneMs]);

  function flip(i: number) {
    if (lock.current || open.includes(i) || matched.has(cards[i].item.id) || doneMs !== null) return;
    const t = start ?? Date.now();
    if (!start) { setStart(t); setNow(t); }
    const next = [...open, i];
    setOpen(next);
    if (next.length < 2) return;
    setMoves((m) => m + 1);
    const [a, b] = next;
    if (cards[a].item.id === cards[b].item.id) {
      const got = new Set(matched).add(cards[a].item.id);
      setMatched(got); setOpen([]);
      if (got.size === MEMORY_MODES[mode]) setDoneMs(Date.now() - t);
    } else {
      lock.current = true;
      setTimeout(() => { setOpen([]); lock.current = false; }, 800);
    }
  }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/memory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, ms: doneMs, moves, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  const elapsed = doneMs ?? (start ? now - start : 0);
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">a little game</p>
      <h1 className="h2">Memory <em>match</em></h1>
      <p className="small muted">Flip two cards at a time and find the pairs. Same pictures for everyone today, so you can race your friends.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {(Object.keys(MEMORY_MODES) as MemoryMode[]).map((m) => <button key={m} className={`chip ${mode === m ? "on" : ""}`} aria-pressed={mode === m} onClick={() => setMode(m)}>{m === "easy" ? `Easy · ${MEMORY_MODES.easy} pairs` : `Full · ${MEMORY_MODES.full} pairs`}</button>)}
        <span className="memory-stats" aria-live="off"><span>⏱ {clock(elapsed)}</span><span>{moves} move{moves === 1 ? "" : "s"}</span></span>
      </div>
      <div className={`memory-grid ${mode}`}>
        {cards.map((c, i) => {
          const up = open.includes(i) || matched.has(c.item.id);
          return (
            <button key={c.key} className={`memory-card ${up ? "up" : ""} ${matched.has(c.item.id) ? "got" : ""}`} onClick={() => flip(i)} aria-label={up ? itemName(c.item, lang) : `Card ${i + 1}, face down`} aria-pressed={up}>
              <span className="memory-face back" aria-hidden="true">☾</span>
              <span className="memory-face front" aria-hidden="true">
                <Image src={photo(c.item.img, 300)} alt="" fill sizes="(max-width: 600px) 25vw, 150px" style={{ objectFit: "cover" }} />
              </span>
            </button>
          );
        })}
      </div>
      {doneMs !== null && (
        <section className="card memory-done" aria-live="polite">
          <b>All matched in {clock(doneMs)} with {moves} moves 🎉</b>
          {!saved ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓ Your best today is {clock(board?.mine?.ms ?? doneMs)}.</p>}
          <button className="btn btn-ghost btn-sm" onClick={() => newGame(mode)}>Play again</button>
        </section>
      )}
      {board && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">Today&apos;s quickest · {mode === "easy" ? "easy" : "full"}</h2>
          {board.top.length ? (
            <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><span className="muted small">{t.moves} moves</span><b>{clock(t.ms)}</b></li>)}</ol>
          ) : <p className="small muted">No times yet today. Set the first one.</p>}
        </section>
      )}
      {date && <p className="tiny muted">New pictures every day.</p>}
    </div>
  );
}
