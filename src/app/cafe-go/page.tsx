"use client";
import "./page.css";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import TwoPlayers from "@/components/TwoPlayers";
import { KOMI, N, bestMove, newGame, pass, play, score, type Level, type State } from "@/lib/go";
import { addFlag } from "@/lib/trophyFlags";

const STATS = "mm-go";
type Rec = { won: number; lost: number };
const STAR = new Set([20, 24, 40, 56, 60]);

export default function CafeGo() {
  const { toast } = useStore();
  const [level, setLevel] = useState<Level>("easy");
  const [two, setTwo] = useState(false);
  const [s, setS] = useState<State>(newGame);
  const [history, setHistory] = useState<State[]>([]);
  const [showArea, setShowArea] = useState(false);
  const [stats, setStats] = useState<Record<Level, Rec>>({ easy: { won: 0, lost: 0 }, hard: { won: 0, lost: 0 } });
  const [recorded, setRecorded] = useState(false);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (v) { setStats({ easy: { won: 0, lost: 0 }, hard: { won: 0, lost: 0 }, ...v.stats }); if (v.level === "hard") setLevel("hard"); } } catch {}
  }, []);
  function saveStats(next: Record<Level, Rec>, lv = level) { setStats(next); try { localStorage.setItem(STATS, JSON.stringify({ stats: next, level: lv })); } catch {} }
  useEffect(() => {
    if (two || s.over || s.turn !== 2) return;
    const id = setTimeout(() => {
      const m = bestMove(s, level);
      if (m === null) { setS(pass(s)); toast("The computer passes."); } else setS(play(s, m) ?? pass(s));
    }, 400);
    return () => clearTimeout(id);
  }, [s, level, two]); // eslint-disable-line react-hooks/exhaustive-deps
  const sc = score(s.b);
  useEffect(() => {
    if (!s.over || recorded) return;
    setRecorded(true);
    const black = sc.black > sc.white;
    if (two) { toast(`${black ? "Black" : "White"} wins, ${Math.max(sc.black, sc.white)} to ${Math.min(sc.black, sc.white)}`); return; }
    if (black) addFlag(level === "hard" ? "go-hard" : "go-win");
    saveStats({ ...stats, [level]: { ...stats[level], [black ? "won" : "lost"]: stats[level][black ? "won" : "lost"] + 1 } });
    toast(black ? `You win, ${sc.black} to ${sc.white} ⚫🎉` : `The computer wins, ${sc.white} to ${sc.black}.`);
  }, [s.over]); // eslint-disable-line react-hooks/exhaustive-deps
  function newGame2(lv = level, twoNow = two) {
    if (!two && !s.over && s.moves > 4) saveStats({ ...stats, [level]: { ...stats[level], lost: stats[level].lost + 1 } }, lv);
    else if (lv !== level) saveStats(stats, lv);
    setLevel(lv); setTwo(twoNow); setS(newGame()); setHistory([]); setRecorded(false); setShowArea(false);
  }
  const human = two || s.turn === 1;
  function tap(i: number) {
    if (!human || s.over) return;
    const n = play(s, i);
    if (!n) return toast(s.b[i] ? "There's a stone there." : "That stone would have no breathing room (or it repeats the board).");
    setHistory([...history, s]); setS(n);
  }
  function undo() {
    // Back to before your last move (and the computer's answer)
    let k = history.length - 1;
    if (k < 0) return;
    setS(history[k]); setHistory(history.slice(0, k));
  }
  const who = (t: 1 | 2) => (two ? (t === 1 ? "Black" : "White") : t === 1 ? "You" : "The computer");
  const status = s.over ? `${sc.black > sc.white ? who(1) : who(2)} win${two || sc.black <= sc.white ? "s" : ""}: black ${sc.black}, white ${sc.white}` : !human ? "Thinking…" : `${who(s.turn)}${two ? " to play" : ": your move"}${s.passes ? ` (${who((3 - s.turn) as 1 | 2)} passed)` : ""}`;
  const area = showArea || s.over ? sc.area : null;
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">a board game</p>
      <h1 className="h2">Café <em>go</em></h1>
      <p className="small muted">The old game of surrounding, on a small 9×9 board. You&apos;re black and go first. Take turns placing stones where the lines cross. A group of stones with no empty point next to it is captured. When there&apos;s nothing useful left, pass; two passes in a row end the game. You score your stones plus the empty points you&apos;ve walled in, and white gets {KOMI} extra for going second. Capture any hopeless stones before you pass: they count for whoever owns them.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {!two && (["easy", "hard"] as const).map((lv) => <button key={lv} className={`chip ${level === lv ? "on" : ""}`} aria-pressed={level === lv} onClick={() => lv !== level && newGame2(lv)}>{lv === "easy" ? "Easy" : "Hard"}</button>)}
        <TwoPlayers on={two} onChange={(v) => newGame2(level, v)} />
        <button className="btn btn-ghost btn-sm" onClick={undo} disabled={!history.length || !human || s.over}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { if (human && !s.over) { setHistory([...history, s]); setS(pass(s)); } }} disabled={!human || s.over}>Pass</button>
        <button className={`chip ${showArea ? "on" : ""}`} aria-pressed={showArea} onClick={() => setShowArea(!showArea)}>Show areas</button>
        <button className="btn btn-ghost btn-sm" onClick={() => newGame2()}>New game</button>
      </div>
      <div className="rv-score" aria-live="polite">
        <span className={s.turn === 1 && !s.over ? "on" : ""}>⚫ {who(1)} <b>{sc.black}</b></span>
        <span className="small muted">{s.caps[0]} · {s.caps[1]} captured</span>
        <span className={s.turn === 2 && !s.over ? "on" : ""}><b>{sc.white}</b> {who(2)} ⚪</span>
      </div>
      <p className="center small" style={{ margin: "0 0 0.4rem" }}><b>{status}</b></p>
      <div className="go-board" role="grid" aria-label="Go board">
        {s.b.map((x, i) => (
          <button key={i} className={`go-pt ${STAR.has(i) ? "star" : ""} ${s.last === i ? "last" : ""} ${area && !x && area[i] ? `own${area[i]}` : ""} ${i % N === 0 ? "l" : ""} ${i % N === N - 1 ? "r" : ""} ${i < N ? "t" : ""} ${i >= N * (N - 1) ? "b" : ""}`}
            onClick={() => tap(i)} aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}: ${x === 1 ? "black" : x === 2 ? "white" : "empty"}`}>
            {x !== 0 && <i className={`go-stone ${x === 1 ? "black" : "white"}`} aria-hidden="true" />}
          </button>
        ))}
      </div>
      {s.over && <p className="center"><button className="btn btn-pink btn-sm" onClick={() => newGame2()}>Play again</button></p>}
      <p className="small muted" style={{ marginTop: "1rem" }}>{two ? "Two-player games don't count towards your record. " : ""}On {level}: won {stats[level].won} · lost {stats[level].lost}</p>
      <p className="tiny muted">The computer is a friendly beginner: it captures, rescues its groups and grabs space, but doesn&apos;t read far ahead. &quot;Show areas&quot; shades who owns the empty points right now.</p>
    </div>
  );
}
