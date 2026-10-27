"use client";
import "../crossword/page.css";
import "./page.css";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ShareResult from "@/components/ShareResult";
import { useReplay } from "@/components/useReplay";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { todayStr } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { HINT_MS, SIZE as N, isSolved, weeklyFor, type WEntry } from "@/lib/weeklyCrossword";
import { addFlag } from "@/lib/trophyFlags";

type Board = { week: string; top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-weeklycross";
const KEYS = ["qwertyuiop", "asdfghjkl", "zxcvbnm⌫"];

export default function WeeklyCrossword() {
  const { toast } = useStore();
  const [today, setToday] = useState("");
  const [letters, setLetters] = useState<string[]>([]);
  const [at, setAt] = useState(0);
  const [down, setDown] = useState(false);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [hints, setHints] = useState(0);
  const [wrong, setWrong] = useState<Set<number>>(new Set());
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => { setToday(todayStr()); try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {} }, []);
  const xw = useMemo(() => (today ? weeklyFor(today) : null), [today]);
  const week = xw?.week ?? "";
  useEffect(() => {
    if (!xw) return;
    let s: { week?: string; letters?: string[]; start?: number; doneMs?: number; saved?: boolean; hints?: number } | null = null;
    try { s = JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch {}
    const ok = s?.week === xw.week && s.letters?.length === N * N;
    setLetters(ok ? s!.letters! : Array(N * N).fill(""));
    setStart(ok ? s!.start ?? null : null); setDoneMs(ok ? s!.doneMs ?? null : null); setSaved(!!(ok && s!.saved)); setHints(ok ? s!.hints ?? 0 : 0);
    setNow(Date.now()); setAt(xw.entries[0].cells[0]); setDown(xw.entries[0].down);
    fetch(`/api/weekly-games?game=crossword&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, [xw]);
  useEffect(() => { if (!rp.on && week && letters.length) try { localStorage.setItem(KEY, JSON.stringify({ week, letters, start, doneMs, saved, hints })); } catch {} }, [week, letters, start, doneMs, saved, hints]); // eslint-disable-line react-hooks/exhaustive-deps
  const rp = useReplay({ key: KEY, date: week, state: letters.length ? letters : null, setState: setLetters, start, doneMs, first: null });
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [start, doneMs]);

  const entry = (p: number, d: boolean) => xw?.entries.find((e) => e.down === d && e.cells.includes(p));
  const current: WEntry | undefined = xw ? entry(at, down) ?? entry(at, !down) : undefined;
  const ordered = xw?.entries ?? [];
  function pick(p: number) {
    if (!xw?.grid[p]) return;
    if (p === at) { if (entry(p, !down)) setDown(!down); }
    else { setAt(p); if (!entry(p, down)) setDown(!down); }
  }
  function jump(step: number) {
    if (!current) return;
    const next = ordered[(ordered.indexOf(current) + step + ordered.length) % ordered.length];
    setDown(next.down); setAt(next.cells.find((c) => !letters[c]) ?? next.cells[0]);
  }
  function finishCheck(next: string[], t: number, h = hints) {
    if (!isSolved(xw!.grid, next)) return;
    setDoneMs(Date.now() - t + h * HINT_MS);
    if (!h) addFlag("weeklycross-no-hints");
    toast("The weekly crossword's done! ✏️🎉");
  }
  function type(k: string) {
    if (!xw || !current || doneMs !== null) return;
    const i = current.cells.indexOf(at);
    if (k === "⌫") {
      if (letters[at]) setLetters(letters.map((x, p) => (p === at ? "" : x)));
      else if (i > 0) { const back = current.cells[i - 1]; setAt(back); setLetters(letters.map((x, p) => (p === back ? "" : x))); }
      return;
    }
    const t = start ?? Date.now();
    if (!start) { setStart(t); setNow(t); }
    const next = letters.map((x, p) => (p === at ? k : x));
    setLetters(next);
    if (wrong.has(at)) setWrong(new Set([...wrong].filter((w) => w !== at)));
    finishCheck(next, t);
    const after = current.cells.slice(i + 1).find((c) => !next[c]);
    if (after !== undefined) setAt(after);
    else if (current.cells.every((c) => next[c])) { const nx = ordered[(ordered.indexOf(current) + 1) % ordered.length]; setDown(nx.down); setAt(nx.cells.find((c) => !next[c]) ?? nx.cells[0]); }
    else if (i < current.cells.length - 1) setAt(current.cells[i + 1]);
  }
  function revealLetter() {
    if (!xw || doneMs !== null) return;
    const t = start ?? Date.now();
    if (!start) { setStart(t); setNow(t); }
    const p = xw.grid[at] && letters[at] !== xw.grid[at] ? at : current?.cells.find((c) => letters[c] !== xw.grid[c]) ?? xw.grid.findIndex((g, c) => g && letters[c] !== g);
    if (p === undefined || p < 0) return;
    const next = letters.map((x, c) => (c === p ? xw.grid[c] : x)), h = hints + 1;
    setLetters(next); setHints(h); setWrong(new Set([...wrong].filter((w) => w !== p)));
    finishCheck(next, t, h);
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || e.metaKey || e.ctrlKey || !xw) return;
      const moves: Record<string, [number, boolean]> = { ArrowUp: [-N, true], ArrowDown: [N, true], ArrowLeft: [-1, false], ArrowRight: [1, false] };
      if (e.key in moves) {
        e.preventDefault();
        const [step, d] = moves[e.key];
        if (d !== down && entry(at, d)) { setDown(d); return; }
        for (let p = at + step; p >= 0 && p < N * N && (Math.abs(step) === 1 ? Math.floor(p / N) === Math.floor(at / N) : true); p += step) if (xw.grid[p]) { setAt(p); break; }
      } else if (/^[a-z]$/i.test(e.key)) type(e.key.toLowerCase());
      else if (e.key === "Backspace") type("⌫");
      else if (e.key === "Tab") { e.preventDefault(); jump(e.shiftKey ? -1 : 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  function check() {
    const bad = new Set(xw!.grid.flatMap((g, p) => (g && letters[p] && letters[p] !== g ? [p] : [])));
    setWrong(bad);
    toast(bad.size ? `${bad.size} square${bad.size === 1 ? "" : "s"} not quite right` : "All good so far ✓");
  }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/weekly-games", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "crossword", ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  if (!xw || !letters.length) return <div className="page"><p className="muted">Ruling the grid…</p></div>;
  const elapsed = doneMs ?? (start ? now - start + hints * HINT_MS : 0);
  const sunday = new Date(Date.parse(`${week}T12:00:00Z`) + 6 * 86400_000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const filled = xw.grid.filter((g, p) => g && letters[p]).length, total = xw.grid.filter(Boolean).length;
  return (
    <div className="page wx" style={{ maxWidth: "44rem" }}>
      <p className="eyebrow">a weekly puzzle</p>
      <h1 className="h2">Weekly <em>crossword</em></h1>
      <p className="small muted">A bigger criss-cross grid with {xw.entries.length} clues, the same all week, until Sunday {sunday}. Your progress saves as you go, so come back to it over coffee. Tap a square; tap it again to switch direction.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        <span className="memory-stats"><span>⏱ {clock(elapsed)}</span><span><b>{filled}</b>/{total}</span></span>
        {doneMs === null && <><button className="btn btn-ghost btn-sm" onClick={check}>Check</button><button className="btn btn-ghost btn-sm" onClick={revealLetter}>Show a letter (+{HINT_MS / 1000}s)</button></>}
      </div>
      {current && doneMs === null && (
        <div className="xw-clue" aria-live="polite">
          <button className="xw-step" onClick={() => jump(-1)} aria-label="Previous clue">‹</button>
          <p><b>{current.num} {current.down ? "down" : "across"}</b> {current.clue} ({current.answer.length})</p>
          <button className="xw-step" onClick={() => jump(1)} aria-label="Next clue">›</button>
        </div>
      )}
      <div className={`xw-grid ${doneMs !== null ? "done" : ""}`} role="grid" data-own-keys="" aria-label="Weekly crossword">
        {xw.grid.map((g, p) => g ? (
          <button key={p} className={`xw-cell ${p === at && doneMs === null ? "at" : current?.cells.includes(p) && doneMs === null ? "line" : ""} ${wrong.has(p) ? "bad" : ""}`} onClick={() => pick(p)}
            aria-label={`Row ${Math.floor(p / N) + 1}, column ${(p % N) + 1}${xw.numbers[p] ? `, ${xw.numbers[p]}` : ""}: ${letters[p] || "empty"}`}>
            {xw.numbers[p] > 0 && <span className="xw-num" aria-hidden="true">{xw.numbers[p]}</span>}
            <span aria-hidden="true">{letters[p]}</span>
          </button>
        ) : <span key={p} className="xw-cell black" aria-hidden="true" />)}
      </div>
      {doneMs === null ? (
        <div className="word-keys" aria-label="Keyboard">
          {KEYS.map((row) => (
            <div key={row} className="word-key-row">
              {row.split("").map((k) => <button key={k} type="button" className={`word-key ${k === "⌫" ? "wide" : ""}`} onClick={() => type(k)} aria-label={k === "⌫" ? "Delete" : k}>{k}</button>)}
            </div>
          ))}
        </div>
      ) : (
        <section className="card memory-done" aria-live="polite">
          <b>Solved in {clock(doneMs)}{hints ? ` (${hints} letter${hints === 1 ? "" : "s"} shown)` : ""} 🎉</b>
          {!saved ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓ Your best this week is {clock(board?.mine?.ms ?? doneMs)}.</p>}
          <p className="tiny muted" style={{ margin: 0 }}>A new grid on Monday.</p>
          <ShareResult title="Weekly crossword" date={todayStr()} replay={rp.replay} />
        </section>
      )}
      <div className="xw-lists">
        {[false, true].map((d) => (
          <section key={String(d)}>
            <h2 className="h3">{d ? "Down" : "Across"}</h2>
            <ol className="xw-list">
              {xw.entries.filter((e) => e.down === d).map((e) => (
                <li key={e.num} className={current === e && doneMs === null ? "on" : e.cells.every((c) => letters[c]) ? "filled" : ""}>
                  <button onClick={() => { setDown(d); setAt(e.cells.find((c) => !letters[c]) ?? e.cells[0]); }}><b>{e.num}</b> {e.clue} ({e.answer.length})</button>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      {board && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">This week&apos;s best</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{clock(t.ms)}</b></li>)}</ol> : <p className="small muted">No times yet this week. Set the first one.</p>}
          <p className="tiny muted">Past weeks&apos; winners are in the <Link href="/hall-of-fame">hall of fame</Link>.</p>
        </section>
      )}
    </div>
  );
}
