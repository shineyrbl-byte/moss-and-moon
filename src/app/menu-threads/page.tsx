"use client";
import "./page.css";
import { Ghost } from "@/components/GameExtras";
import { useMemo, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import ArchiveNote from "@/components/ArchiveNote";
import { DoneCard, TodayBoard, useDaily } from "@/components/DailyDone";
import { isPast } from "@/lib/archive";
import { clock } from "@/lib/memory";
import { COLS, HINT_EVERY, ROWS, matchThread, otherWord, spell, threadsFor, touching } from "@/lib/threads";
import { addFlag } from "@/lib/trophyFlags";

type S = { found: string[]; extras: string[]; shown: string[] };
const TINTS = ["#f6c9d4", "#cfdcc0", "#f8e2a9", "#c6dcec", "#dccdea", "#f7cfb2", "#bfe3d6", "#ead6c4", "#e8c1c9"];

export default function MenuThreads() {
  const { toast } = useStore();
  const d = useDaily<S>("threads", "mm-threads", () => ({ found: [], extras: [], shown: [] }));
  const [path, setPath] = useState<number[]>([]);
  const dragging = useRef(false), moved = useRef(false);
  const puzzle = useMemo(() => (d.date ? threadsFor(d.date) : null), [d.date]);
  if (!puzzle || !d.state) return <div className="page"><p className="muted">Threading the menu…</p></div>;
  const st = d.state, done = d.doneMs !== null, past = isPast(d.date);
  const owner = Array(ROWS * COLS).fill(-1);
  puzzle.threads.forEach((t, k) => { if (st.found.includes(t.word)) t.cells.forEach((c) => { owner[c] = k; }); });
  const hinted = new Set(puzzle.threads.filter((t) => st.shown.includes(t.word) && !st.found.includes(t.word)).flatMap((t) => t.cells));
  const earned = Math.floor(st.extras.length / HINT_EVERY) - st.shown.length;

  function send(cells = path) {
    setPath([]);
    if (cells.length < 2 || done) return;
    const t = d.tick();
    const word = spell(puzzle!.grid, cells);
    const hit = matchThread(puzzle!.threads, cells);
    if (hit && !st.found.includes(hit.word)) {
      const found = [...st.found, hit.word];
      d.setState({ ...st, found });
      if (found.length === puzzle!.threads.length) {
        d.setDoneMs(Date.now() - t);
        if (!st.shown.length) addFlag("threads-no-hints");
        toast("Every thread found! 🧵🎉");
      } else toast(`${hit.word.toUpperCase()} ✓`);
      return;
    }
    if (hit) return toast("You've found that one.");
    if (puzzle!.threads.some((x) => x.word === word)) return toast("Right word, but its letters run a different way. Try another path.");
    if (otherWord(word) && !st.extras.includes(word)) {
      const extras = [...st.extras, word];
      d.setState({ ...st, extras });
      const left = HINT_EVERY - (extras.length % HINT_EVERY);
      return toast(extras.length % HINT_EVERY === 0 ? `${word.toUpperCase()} isn't on the menu, but you've earned a hint 💡` : `${word.toUpperCase()} is a word, just not on today's menu. ${left} more for a hint.`);
    }
    if (word.length < 4) return toast("Words need at least 4 letters.");
    toast(otherWord(word) ? "You've tried that one." : "That's not a word we know.");
  }
  function press(i: number) {
    if (done || owner[i] !== -1) return;
    const at = path.indexOf(i);
    if (at === path.length - 1 && path.length) return send();
    if (at >= 0) { setPath(path.slice(0, at + 1)); return; }
    if (path.length && !touching(path[path.length - 1], i)) { setPath([i]); return; }
    setPath([...path, i]);
  }
  function drag(i: number) {
    if (!dragging.current || owner[i] !== -1) return;
    if (path.length > 1 && path[path.length - 2] === i) { setPath(path.slice(0, -1)); moved.current = true; return; }
    if (!path.includes(i) && path.length && touching(path[path.length - 1], i)) { setPath([...path, i]); moved.current = true; }
  }
  function takeHint() {
    const t = puzzle!.threads.find((x) => !st.found.includes(x.word) && !st.shown.includes(x.word));
    if (!t || earned < 1) return;
    d.setState({ ...st, shown: [...st.shown, t.word] });
  }
  const live = path.length ? spell(puzzle.grid, path).toUpperCase() : "";
  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">a daily word game</p>
      <ArchiveNote date={d.date} path="/menu-threads" />
      <h1 className="h2">Menu <em>threads</em></h1>
      <p className="small muted">Every letter belongs to one of today&apos;s menu words, and together they fill the whole grid. Find them all by joining letters that touch (across, down or corner to corner). Other real words you spot earn hints.</p>
      <p className="mt-theme"><small>Today&apos;s theme</small><b>{puzzle.title}</b></p>
      <div className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>Found <b>{st.found.length}</b>/{puzzle.threads.length}</span><span className="mm-clock">⏱ {clock(d.elapsed)}</span></div>
      <Ghost elapsed={d.elapsed} done={d.doneMs !== null} />
      <p className="lb-word" aria-live="polite">{live || <span className="muted">{done ? "✓" : " "}</span>}</p>
      <div className={`mt-grid ${done ? "done" : ""}`} style={{ ["--c" as string]: COLS }} role="group" data-grid="" aria-label="Letter grid"
        onPointerUp={() => { const go = dragging.current && moved.current && path.length > 1; dragging.current = false; moved.current = false; if (go) send(); }}
        onPointerLeave={() => { dragging.current = false; moved.current = false; }}>
        {puzzle.grid.map((ch, i) => (
          <button key={i} className={`mt-cell ${path.includes(i) ? "on" : ""} ${hinted.has(i) ? "hint" : ""}`} style={owner[i] !== -1 ? { background: TINTS[owner[i] % TINTS.length] } : undefined} disabled={done || owner[i] !== -1}
            onPointerDown={(e) => { (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); dragging.current = true; moved.current = false; press(i); }}
            onPointerEnter={() => drag(i)} onClick={(e) => { if (e.detail === 0) press(i); }}
            aria-label={`${ch.toUpperCase()}${owner[i] !== -1 ? ", found" : path.includes(i) ? ", in your word" : ""}`}>{ch.toUpperCase()}</button>
        ))}
      </div>
      <div className="row" style={{ justifyContent: "center", gap: "0.5rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setPath([])} disabled={!path.length}>Clear</button>
        <button className="btn btn-pink btn-sm" onClick={() => send()} disabled={path.length < 2}>Enter</button>
        <button className="btn btn-ghost btn-sm" onClick={takeHint} disabled={done || earned < 1}>💡 Hint{earned > 0 ? ` (${earned})` : ""}</button>
      </div>
      <p className="tiny muted center">{st.extras.length % HINT_EVERY}/{HINT_EVERY} other words towards your next hint. A hint outlines one of the menu words.</p>
      {st.found.length > 0 && <p className="center small">{st.found.map((w) => w.toUpperCase()).join(" · ")}</p>}
      {done && <DoneCard replay={d.replay} game="threads" title="Menu threads" date={d.date} past={past} headline={`All ${puzzle.threads.length} found in ${clock(d.doneMs ?? 0)}${st.shown.length ? ` (${st.shown.length} hint${st.shown.length === 1 ? "" : "s"})` : ", no hints"} 🎉`} score={d.doneMs!} saved={d.saved} onSaved={(b) => { d.setBoard(b); d.setSaved(true); }} />}
      {!past && <TodayBoard board={d.board} show={clock} />}
    </div>
  );
}
