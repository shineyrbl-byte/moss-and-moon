"use client";
import "../sudoku/page.css";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { ICONS, ICON_NAMES, N, clashes, isComplete } from "@/lib/sudoku";
import { MIN_GIVEN, check, decode, encode, type Verdict } from "@/lib/puzzleMaker";
import { clock } from "@/lib/memory";
import { addFlag } from "@/lib/trophyFlags";

const DRAFT = "mm-maker-draft";
const rowOf = (p: number) => Math.floor(p / N), colOf = (p: number) => p % N;
const cleanText = (s: string | null, n: number) => (s ?? "").replace(/[<>]/g, "").slice(0, n);

function Grid({ cells, given, at, setAt, bad, hot, done }: { cells: number[]; given: (p: number) => boolean; at: number | null; setAt: (p: number) => void; bad: Set<number>; hot?: number | null; done?: boolean }) {
  return (
    <div className={`sd-grid ${done ? "done" : ""}`} role="grid" data-own-keys="" aria-label="Mini sudoku">
      {cells.map((v, p) => {
        const same = at !== null && (rowOf(p) === rowOf(at) || colOf(p) === colOf(at));
        return (
          <button key={p} className={`sd-cell ${given(p) ? "given" : ""} ${at === p ? "at" : same ? "line" : ""} ${bad.has(p) ? "bad" : ""} ${hot === p ? "at" : ""} ${colOf(p) === 2 ? "edge-r" : ""} ${rowOf(p) % 2 === 1 && rowOf(p) < N - 1 ? "edge-b" : ""}`}
            onClick={() => setAt(p)} aria-pressed={at === p} aria-label={`Row ${rowOf(p) + 1}, column ${colOf(p) + 1}: ${v ? ICON_NAMES[v - 1] : "empty"}${given(p) ? ", given" : ""}`}>
            <span aria-hidden="true">{v ? ICONS[v - 1] : ""}</span>
          </button>
        );
      })}
    </div>
  );
}
function Pad({ put, disabled }: { put: (v: number) => void; disabled: boolean }) {
  return (
    <div className="sd-pad" role="group" aria-label="Treats">
      {ICONS.map((ic, i) => <button key={ic} className="sd-key" onClick={() => put(i + 1)} disabled={disabled} aria-label={ICON_NAMES[i]}>{ic}</button>)}
      <button className="sd-key" onClick={() => put(0)} disabled={disabled} aria-label="Clear">⌫</button>
    </div>
  );
}

export default function PuzzleMaker() {
  const { toast } = useStore();
  const [mode, setMode] = useState<"loading" | "make" | "play">("loading");
  // Making
  const [design, setDesign] = useState<number[]>(Array(N * N).fill(0));
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [title, setTitle] = useState("");
  const [by, setBy] = useState("");
  // Playing someone's puzzle
  const [puzzle, setPuzzle] = useState<number[]>([]);
  const [cells, setCells] = useState<number[]>([]);
  const [meta, setMeta] = useState({ title: "", by: "" });
  const [start, setStart] = useState<number | null>(null);
  const [doneMs, setDoneMs] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [at, setAt] = useState<number | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(location.search), p = decode(q.get("p"));
    if (p && check(p).kind === "one") {
      setPuzzle(p); setCells([...p]); setMeta({ title: cleanText(q.get("t"), 40), by: cleanText(q.get("by"), 20) }); setMode("play"); return;
    }
    if (q.get("p")) toast("That puzzle link doesn't look right, so here's the maker instead.");
    try { const d = decode(localStorage.getItem(DRAFT)); if (d) setDesign(d); setBy(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    setMode("make");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (mode === "make") try { localStorage.setItem(DRAFT, encode(design)); } catch {} }, [design, mode]);
  useEffect(() => { if (!start || doneMs !== null) return; const id = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(id); }, [start, doneMs]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || at === null) return;
      const k = Number(e.key);
      if (k >= 1 && k <= 6) { e.preventDefault(); (mode === "make" ? place : fill)(k); }
      else if (e.key === "Backspace" || e.key === "0") { e.preventDefault(); (mode === "make" ? place : fill)(0); }
      else if (e.key.startsWith("Arrow")) { e.preventDefault(); const d = { ArrowUp: -N, ArrowDown: N, ArrowLeft: -1, ArrowRight: 1 }[e.key] ?? 0; setAt(Math.max(0, Math.min(N * N - 1, at + d))); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  function place(v: number) { if (at === null) return; setDesign(design.map((x, p) => (p === at ? v : x))); setVerdict(null); }
  function fill(v: number) {
    if (at === null || puzzle[at] || doneMs !== null) return;
    const t = start ?? Date.now();
    if (!start) { setStart(t); setNow(t); }
    const next = cells.map((x, p) => (p === at ? v : x));
    setCells(next);
    if (isComplete(next)) { setDoneMs(Date.now() - t); toast("Solved! 🎉"); }
  }
  async function share() {
    const url = `${location.origin}/puzzle-maker?p=${encode(design)}${title ? `&t=${encodeURIComponent(title)}` : ""}${by ? `&by=${encodeURIComponent(by)}` : ""}`;
    try { localStorage.setItem("mm-game-name", by); } catch {}
    addFlag("maker-shared");
    const text = `I made a mini sudoku${title ? `, "${title}"` : ""}. Can you solve it?`;
    try { if (navigator.share) await navigator.share({ text, url }); else { await navigator.clipboard.writeText(`${text}\n${url}`); toast("Puzzle link copied 📋"); } } catch {}
  }
  if (mode === "loading") return <div className="page"><p className="muted">Getting the pencils out…</p></div>;
  if (mode === "play") {
    const bad = new Set([...clashes(cells)].filter((p) => !puzzle[p]));
    return (
      <div className="page" style={{ maxWidth: "30rem" }}>
        <p className="eyebrow">a puzzle from a friend</p>
        <h1 className="h2">{meta.title || "A mini sudoku"}{meta.by ? <em> by {meta.by}</em> : null}</h1>
        <p className="small muted">Fill the grid so every row, column and box has each of the six treats once. Tap a square, then a treat (or type 1 to 6). It&apos;s been checked: there&apos;s exactly one answer.</p>
        <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>⏱ {clock(doneMs ?? (start ? now - start : 0))}</span></div>
        <Grid cells={cells} given={(p) => !!puzzle[p]} at={doneMs === null ? at : null} setAt={setAt} bad={bad} done={doneMs !== null} />
        {doneMs === null ? <Pad put={fill} disabled={at === null || !!puzzle[at]} /> : (
          <section className="card memory-done"><b>Solved in {clock(doneMs)} 🎉</b><p className="small" style={{ margin: 0 }}>Your turn: make one back.</p><a className="btn btn-pink btn-sm" href="/puzzle-maker">✏️ Make a puzzle</a></section>
        )}
      </div>
    );
  }
  const given = design.filter(Boolean).length, bad = clashes(design);
  return (
    <div className="page" style={{ maxWidth: "32rem" }}>
      <p className="eyebrow">the games</p>
      <h1 className="h2">Puzzle <em>maker</em></h1>
      <p className="small muted">Make a mini sudoku for a friend. Put down some treats as the starting clues, then check it. A good puzzle has exactly one answer; we&apos;ll tell you if yours has none or too many, and point to a square that could help. Then share the link: the puzzle travels in the link itself.</p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span><b>{given}</b> clues</span></div>
      <Grid cells={design} given={(p) => !!design[p]} at={at} setAt={setAt} bad={bad} hot={verdict?.kind === "many" ? verdict.differ : null} />
      <Pad put={place} disabled={at === null} />
      <div className="row" style={{ justifyContent: "center", gap: "0.5rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
        <button className="btn btn-pink btn-sm" onClick={() => setVerdict(check(design))} disabled={given < MIN_GIVEN || bad.size > 0}>Check it</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setDesign(Array(N * N).fill(0)); setVerdict(null); }} disabled={!given}>Clear all</button>
      </div>
      <p className="center small" role="status" style={{ minHeight: "1.4em" }}>
        {bad.size ? "Some treats clash (red): two the same in a row, column or box." : given < MIN_GIVEN ? `Put down at least ${MIN_GIVEN} clues to start.` : !verdict ? "" : verdict.kind === "none" ? "❌ No answer fits these clues. Try moving one." : verdict.kind === "many" ? "🤔 More than one answer works. Add a clue: the highlighted square would be a good one." : "✅ Exactly one answer. It's ready to share!"}
      </p>
      {verdict?.kind === "one" && (
        <section className="card" style={{ padding: "1rem 1.1rem" }}>
          <label className="field">Give it a name (optional)<input className="input" maxLength={40} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Saturday treat" /></label>
          <label className="field">Your name (optional)<input className="input" maxLength={20} value={by} onChange={(e) => setBy(e.target.value)} placeholder="Guest" /></label>
          <button className="btn btn-pink btn-sm" onClick={share}>📤 Share the puzzle</button>
        </section>
      )}
      <p className="tiny muted" style={{ marginTop: "1rem" }}>Tap a square, then a treat to put it there (or type 1 to 6, and use the arrow keys). Your design is saved on this device as you go.</p>
    </div>
  );
}
