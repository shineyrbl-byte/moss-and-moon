"use client";
import { useEffect, useMemo, useState } from "react";
import ShareResult from "@/components/ShareResult";
import ArchiveNote from "@/components/ArchiveNote";
import { dayKey, isPast, playDay } from "@/lib/archive";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { clock } from "@/lib/memory";
import { HINT_MS, kenkenOf, label } from "@/lib/kenken";
import { addFlag } from "@/lib/trophyFlags";

type Board = { top: { name: string; ms: number }[]; mine: { ms: number } | null; played: number };
const KEY = "mm-tipjar";
const OP_WORD: Record<string, string> = { "+": "add to", "×": "multiply to", "−": "differ by", "÷": "divide to", "=": "is" };

export default function TipJar() {
  const { toast } = useStore();
  const [date, setDate] = useState("");
  const past = isPast(date);
  const [g, setG] = useState<number[] | null>(null);
  const [sel, setSel] = useState(0);
  const [history, setHistory] = useState<number[][]>([]);
  const [hints, setHints] = useState(0);
  const [hinted, setHinted] = useState<number | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<"daily" | "hard">("daily");
  // Normal is 5×5; hard is 6×6 with 1 to 6
  const K = useMemo(() => kenkenOf(mode === "hard" ? 6 : 5), [mode]);
  const { N, clashes, isSolved, jarFor } = K;
  const store = dayKey(mode === "hard" ? `${KEY}-hard` : KEY);
  const puzzle = useMemo(() => (date ? jarFor(date) : null), [date, jarFor]);
  const cageOf = useMemo(() => {
    const a = Array(N * N).fill(0);
    puzzle?.cages.forEach((c, k) => c.cells.forEach((i) => { a[i] = k; }));
    return a;
  }, [puzzle, N]);
  useEffect(() => {
    const d = playDay();
    setDate(d);
    try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    try { if (localStorage.getItem("mm-tipjar-mode") === "hard") setMode("hard"); } catch {}
  }, []);
  useEffect(() => { fetch(`/api/daily-scores?game=tipjar&mode=${mode}&voter=${voterId()}`).then((r) => r.json()).then(setBoard).catch(() => {}); }, [mode]);
  useEffect(() => {
    if (!puzzle) return;
    let s: { date?: string; g?: number[]; hints?: number; start?: number; doneMs?: number; saved?: boolean } | null = null;
    try { s = JSON.parse(localStorage.getItem(store) ?? "null"); } catch {}
    if (s?.date === date && s.g?.length === N * N) { setG(s.g); setHints(s.hints ?? 0); setStart(s.start ?? null); setDoneMs(s.doneMs ?? null); setSaved(!!s.saved); }
    else { setG(Array(N * N).fill(0)); setHints(0); setStart(null); setDoneMs(null); setSaved(false); }
    setHistory([]); setHinted(null); setSel(0);
    setNow(Date.now());
  }, [puzzle, date]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (date && g) try { localStorage.setItem(store, JSON.stringify({ date, g, hints, start, doneMs, saved })); } catch {} }, [date, g, hints, start, doneMs, saved]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!start || doneMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [start, doneMs]);
  const done = doneMs !== null;

  function put(next: number[], usedHint = false) {
    const t = start ?? Date.now();
    if (!start) { setStart(t); setNow(t); }
    setHistory([...history, g!]); setG(next);
    if (isSolved(puzzle!.cages, next)) {
      const h = hints + (usedHint ? 1 : 0);
      setDoneMs(Date.now() - t + h * HINT_MS);
      if (!h) addFlag("tipjar-no-hints");
      toast("Every jar adds up! 🪙🎉");
    }
  }
  function enter(v: number) {
    if (done || !g || g[sel] === v) return;
    const next = [...g]; next[sel] = v;
    setHinted(null); put(next);
  }
  function hint() {
    if (!g || !puzzle) return;
    const i = g.findIndex((v, k) => v !== puzzle.solution[k]);
    if (i < 0) return;
    const next = [...g]; next[i] = puzzle.solution[i];
    setHints(hints + 1); setHinted(i); setSel(i); put(next, true);
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement).tagName;
      if (t === "INPUT" || e.metaKey || e.ctrlKey || done) return;
      const r = Math.floor(sel / N), c = sel % N;
      const move: Record<string, number> = { ArrowUp: r > 0 ? sel - N : sel, ArrowDown: r < N - 1 ? sel + N : sel, ArrowLeft: c > 0 ? sel - 1 : sel, ArrowRight: c < N - 1 ? sel + 1 : sel };
      if (e.key in move) { e.preventDefault(); setSel(move[e.key]); }
      else if (/^[1-9]$/.test(e.key) && Number(e.key) <= N) enter(Number(e.key));
      else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") enter(0);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  async function save() {
    try { localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/daily-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: "tipjar", mode, ms: doneMs, name, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBoard(d); setSaved(true);
  }
  if (!puzzle || !g) return <div className="page"><p className="muted">Counting the tips…</p></div>;
  const { cages } = puzzle;
  const bad = clashes(cages, g);
  const elapsed = doneMs ?? (start ? now - start + hints * HINT_MS : 0);
  const left = g.filter((v) => !v).length;
  const edge = (i: number) => {
    const r = Math.floor(i / N), c = i % N, me = cageOf[i];
    return `${r > 0 && cageOf[i - N] !== me ? "et " : ""}${c > 0 && cageOf[i - 1] !== me ? "el " : ""}${r < N - 1 && cageOf[i + N] !== me ? "eb " : ""}${c < N - 1 && cageOf[i + 1] !== me ? "er" : ""}`;
  };
  const selCage = cages[cageOf[sel]];
  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <ArchiveNote date={date} path="/tip-jar" />
      <h1 className="h2">Tip <em>jar</em></h1>
      <p className="small muted">Fill the grid with the numbers 1 to {N}, each once in every row and every column. The squares in each outlined jar have to make the number in its corner with its sign: + adds, × multiplies, − is the gap between two, ÷ is the bigger divided by the smaller. A jar with no sign is just that number. There&apos;s only one answer.</p>
      <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        {(["daily", "hard"] as const).map((m) => <button key={m} className={`chip ${mode === m ? "on" : ""}`} aria-pressed={mode === m} onClick={() => { setMode(m); try { localStorage.setItem("mm-tipjar-mode", m); } catch {} }}>{m === "daily" ? "Normal 5×5" : "Hard 6×6"}</button>)}
        <button className="btn btn-ghost btn-sm" onClick={hint} disabled={done}>Hint (+{HINT_MS / 1000}s)</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { const p = history[history.length - 1]; if (p) { setG(p); setHistory(history.slice(0, -1)); setHinted(null); } }} disabled={!history.length || done}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setHistory([...history, g]); setG(Array(N * N).fill(0)); setHinted(null); }} disabled={done || g.every((v) => !v)}>Start over</button>
      </div>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span><b>{left}</b> to fill</span><span>⏱ {clock(elapsed)}</span></div>
      <div className={`tj-grid ${done ? "done" : ""}`} style={{ ["--n" as string]: N }} role="grid" aria-label="Tip jar grid">
        {g.map((v, i) => {
          const cage = cages[cageOf[i]], first = cage.cells[0] === i;
          return (
            <button key={i} className={`tj-cell ${edge(i)} ${sel === i ? "sel" : ""} ${bad.has(i) ? "bad" : ""} ${hinted === i ? "hint" : ""} ${cageOf[i] === cageOf[sel] ? "same" : ""}`} onClick={() => setSel(i)} disabled={done}
              aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}: ${v || "empty"}. Jar of ${cage.cells.length}: ${cage.op === "=" ? `is ${cage.target}` : `${OP_WORD[cage.op]} ${cage.target}`}${bad.has(i) ? ", breaks a rule" : ""}`}>
              {first && <small className="tj-label" aria-hidden="true">{label(cage)}</small>}
              <span className="tj-num">{v || ""}</span>
            </button>
          );
        })}
      </div>
      <p className="small center" aria-live="polite" style={{ margin: "0.2rem 0 0.4rem" }}>
        {done ? " " : <>This jar: {selCage.cells.length} square{selCage.cells.length === 1 ? "" : "s"} that {selCage.op === "=" ? "is" : OP_WORD[selCage.op]} <b>{selCage.target}</b></>}
      </p>
      <div className="tj-pad" aria-label="Numbers" style={{ gridTemplateColumns: `repeat(${N + 1}, minmax(0, 1fr))` }}>
        {[...Array(N).keys()].map((k) => k + 1).map((v) => <button key={v} className="btn btn-ghost" onClick={() => enter(v)} disabled={done}>{v}</button>)}
        <button className="btn btn-ghost" onClick={() => enter(0)} disabled={done} aria-label="Clear square">⌫</button>
      </div>
      <p className="tiny muted center">Tap a square, then a number. On a keyboard: arrows to move, 1 to {N} to fill, backspace to clear. Repeats and jars that don&apos;t add up turn red.</p>
      {done && (
        <section className="card memory-done" aria-live="polite">
          <b>Counted in {clock(doneMs)}{hints ? ` (${hints} hint${hints === 1 ? "" : "s"})` : ", no hints"} 🎉</b>
          {past ? <p className="small" style={{ margin: 0 }}>Archive days don&apos;t go on the board.</p> : !saved ? (
            <div className="row" style={{ alignItems: "end", justifyContent: "center" }}>
              <label className="field" style={{ maxWidth: "12rem" }}>Name for the board<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
              <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save my time</button>
            </div>
          ) : <p className="small" style={{ margin: 0 }}>Saved ✓</p>}
          <p className="tiny muted" style={{ margin: 0 }}>A new jar tomorrow.</p>
          <ShareResult title="Tip jar" date={date} />
        </section>
      )}
      {board && !past && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">Today&apos;s quickest</h2>
          {board.top.length ? <ol className="memory-board">{board.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{clock(t.ms)}</b></li>)}</ol> : <p className="small muted">No times yet today. Set the first one.</p>}
          <p className="tiny muted">Each hint adds {HINT_MS / 1000} seconds.</p>
        </section>
      )}
    </div>
  );
}
