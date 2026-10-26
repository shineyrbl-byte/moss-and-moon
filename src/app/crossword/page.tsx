"use client";
import { useEffect, useMemo, useState } from "react";
import ArchiveNote from "@/components/ArchiveNote";
import { dayKey, isPast, playDay } from "@/lib/archive";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { clock } from "@/lib/memory";
import { crosswordFor, isSolved, solutionOf, XW_SIZE as N, type Entry } from "@/lib/crossword";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-crossword";
const KEYS = ["qwertyuiop", "asdfghjkl", "zxcvbnm⌫"];

export default function Crossword() {
  const { toast } = useStore();
  const [date, setDate] = useState("");
  const past = isPast(date);
  const [letters, setLetters] = useState<string[]>([]);
  const [at, setAt] = useState(0);
  const [dir, setDir] = useState<"across" | "down">("across");
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [wrong, setWrong] = useState<Set<number>>(new Set());
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => { setDate(playDay()); try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {} }, []);
  const xw = useMemo(() => (date ? crosswordFor(date) : null), [date]);
  const solution = useMemo(() => (xw ? solutionOf(xw.rows) : []), [xw]);
  useEffect(() => {
    if (!xw) return;
    let s: { date?: string; letters?: string[]; start?: number; doneMs?: number; saved?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(dayKey(KEY)) ?? "null"); } catch {}
    const fresh = s?.date === date && s.letters?.length === N * N;
    setLetters(fresh ? s!.letters! : Array(N * N).fill(""));
    setStart(fresh ? s!.start ?? null : null); setNow(Date.now());
    setDoneMs(fresh ? s!.doneMs ?? null : null); setSaved(!!(fresh && s!.saved));
    setAt(xw.entries[0].cells[0]); setDir("across");
    fetch(`/api/daily-scores?game=crossword&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {});
  }, [xw, date]);
  useEffect(() => { if (date && letters.length) try { localStorage.setItem(dayKey(KEY), JSON.stringify({ date, letters, start, doneMs, saved })); } catch {} }, [date, letters, start, doneMs, saved]);
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [start, doneMs]);

  const entry = (p: number, d: "across" | "down") => xw?.entries.find((e) => e.dir === d && e.cells.includes(p));
  const current: Entry | undefined = xw ? entry(at, dir) ?? entry(at, dir === "across" ? "down" : "across") : undefined;
  const ordered = xw ? [...xw.entries.filter((e) => e.dir === "across"), ...xw.entries.filter((e) => e.dir === "down")] : [];
  function pick(p: number) {
    if (!solution[p]) return;
    if (p === at) { const other = dir === "across" ? "down" : "across"; if (entry(p, other)) setDir(other); }
    else { setAt(p); if (!entry(p, dir)) setDir(dir === "across" ? "down" : "across"); }
  }
  function jump(step: number) {
    if (!current) return;
    const next = ordered[(ordered.indexOf(current) + step + ordered.length) % ordered.length];
    setDir(next.dir); setAt(next.cells.find((c) => !letters[c]) ?? next.cells[0]);
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
    if (isSolved(next, xw.rows)) { setDoneMs(Date.now() - t); toast("Solved! 🎉"); return; }
    // Next empty square in this answer, or the next answer once it's full
    const after = current.cells.slice(i + 1).find((c) => !next[c]);
    if (after !== undefined) setAt(after);
    else if (current.cells.every((c) => next[c])) { const nx = ordered[(ordered.indexOf(current) + 1) % ordered.length]; setDir(nx.dir); setAt(nx.cells.find((c) => !next[c]) ?? nx.cells[0]); }
    else if (i < current.cells.length - 1) setAt(current.cells[i + 1]);
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || e.metaKey || e.ctrlKey) return;
      const moves: Record<string, [number, "across" | "down"]> = { ArrowUp: [-N, "down"], ArrowDown: [N, "down"], ArrowLeft: [-1, "across"], ArrowRight: [1, "across"] };
      if (e.key in moves) {
        e.preventDefault();
        const [step, d] = moves[e.key];
        if (d !== dir && entry(at, d)) { setDir(d); return; }
        for (let p = at + step; p >= 0 && p < N * N && (step === 1 || step === -1 ? Math.floor(p / N) === Math.floor(at / N) : true); p += step) if (solution[p]) { setAt(p); break; }
      } else if (/^[a-z]$/i.test(e.key)) type(e.key.toLowerCase());
      else if (e.key === "Backspace") type("⌫");
      else if (e.key === "Tab") { e.preventDefault(); jump(e.shiftKey ? -1 : 1); }
      else if (e.key === " ") { e.preventDefault(); pick(at); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  function check() {
    const bad = new Set(solution.map((s, p) => (s && letters[p] && letters[p] !== s ? p : -1)).filter((p) => p >= 0));
    setWrong(bad);
    toast(bad.size ? `${bad.size} square${bad.size === 1 ? "" : "s"} not quite right` : "All good so far ✓");
  }
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "crossword", ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  if (!xw || !letters.length) return <div className="page"><p className="muted">Sharpening the pencils…</p></div>;
  const elapsed = doneMs ?? (start ? now - start : 0);
  return (
    <div className="page" style={{ maxWidth: "38rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={date} path="/crossword" />
      <h1 className="h2">Mini <em>crossword</em></h1>
      <p className="small muted">A new five-by-five every day. Tap a square to start; tap it again to switch between across and down.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        <span className="memory-stats"><span>⏱ {clock(elapsed)}</span></span>
        {doneMs === null && <button className="btn btn-ghost btn-sm" onClick={check}>Check</button>}
      </div>
      {current && doneMs === null && (
        <div className="xw-clue" aria-live="polite">
          <button className="xw-step" onClick={() => jump(-1)} aria-label="Previous clue">‹</button>
          <p><b>{current.num} {current.dir}</b> {current.clue}</p>
          <button className="xw-step" onClick={() => jump(1)} aria-label="Next clue">›</button>
        </div>
      )}
      <div className={`xw-grid ${doneMs !== null ? "done" : ""}`} role="grid" aria-label="Crossword">
        {solution.map((s, p) => s ? (
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
          <b>Solved in {clock(doneMs)} 🎉</b>
          {past ? <p className="small" style={{ margin: 0 }}>Archive days don&apos;t go on the board.</p> : !saved ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓ Your best today is {clock(board?.mine?.ms ?? doneMs)}.</p>}
          <p className="tiny muted" style={{ margin: 0 }}>A new grid tomorrow.</p>
        </section>
      )}
      <div className="xw-lists">
        {(["across", "down"] as const).map((d) => (
          <section key={d}>
            <h2 className="h3" style={{ textTransform: "capitalize" }}>{d}</h2>
            <ol className="xw-list">
              {xw.entries.filter((e) => e.dir === d).map((e) => (
                <li key={e.num} className={current === e && doneMs === null ? "on" : e.cells.every((c) => letters[c]) ? "filled" : ""}>
                  <button onClick={() => { setDir(d); setAt(e.cells.find((c) => !letters[c]) ?? e.cells[0]); }}><b>{e.num}</b> {e.clue}</button>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      {board && !past && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">Today&apos;s quickest</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{clock(t.ms)}</b></li>)}</ol> : <p className="small muted">No times yet today. Set the first one.</p>}
        </section>
      )}
    </div>
  );
}
