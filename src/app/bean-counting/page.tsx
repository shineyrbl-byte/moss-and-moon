"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { AI_STORE, MY_STORE, bestPit, legal, sow, start, type Board, type Level, type Side } from "@/lib/mancala";

const STATS = "mm-mancala";
type Rec = { won: number; lost: number; drawn: number };
const empty = (): Record<Level, Rec> => ({ easy: { won: 0, lost: 0, drawn: 0 }, hard: { won: 0, lost: 0, drawn: 0 } });
type Snap = { board: Board; turn: Side | null; last: number | null };

function Beans({ n }: { n: number }) {
  return (
    <span className="mc-beans" aria-hidden="true">
      {[...Array(Math.min(n, 12)).keys()].map((i) => <i key={i} style={{ ["--r" as string]: `${(i * 47) % 360}deg` }} />)}
    </span>
  );
}

export default function BeanCounting() {
  const { toast } = useStore();
  const [level, setLevel] = useState<Level>("easy");
  const [s, setS] = useState<Snap>({ board: start(), turn: 0, last: null });
  const [history, setHistory] = useState<Snap[]>([]);
  const [note, setNote] = useState("Your go. Tap one of your cups along the bottom.");
  const [stats, setStats] = useState(empty());
  const [recorded, setRecorded] = useState(false);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(STATS) ?? "null"); if (v) { setStats({ ...empty(), ...v.stats }); if (v.level === "hard") setLevel("hard"); } } catch {}
  }, []);
  function saveStats(next: Record<Level, Rec>, lv = level) { setStats(next); try { localStorage.setItem(STATS, JSON.stringify({ stats: next, level: lv })); } catch {} }
  const over = s.turn === null;
  const me = s.board[MY_STORE], them = s.board[AI_STORE];

  function describe(who: "You" | "The computer", r: NonNullable<ReturnType<typeof sow>>) {
    if (r.over) return "";
    if (r.captured) return `${who} captured ${r.captured} beans!`;
    if (r.again) return `${who === "You" ? "Your" : "Its"} last bean landed in the jar, so ${who === "You" ? "you go" : "it goes"} again.`;
    return "";
  }
  function move(pit: number) {
    if (s.turn !== 0) return;
    const r = sow(s.board, pit, 0);
    if (!r) return;
    setHistory([...history, s]);
    setS({ board: r.board, turn: r.over ? null : r.next, last: pit });
    setNote(describe("You", r) || "The computer's thinking…");
  }
  useEffect(() => {
    if (s.turn !== 1) return;
    const id = setTimeout(() => {
      const pit = bestPit(s.board, level);
      if (pit === null) return;
      const r = sow(s.board, pit, 1)!;
      setS({ board: r.board, turn: r.over ? null : r.next, last: pit });
      setNote(describe("The computer", r) || "Your go.");
    }, 700);
    return () => clearTimeout(id);
  }, [s, level]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!over || recorded) return;
    setRecorded(true);
    const r = me > them ? "won" : me < them ? "lost" : "drawn";
    saveStats({ ...stats, [level]: { ...stats[level], [r]: stats[level][r] + 1 } });
    toast(r === "won" ? "You win! 🫘🎉" : r === "lost" ? "The computer wins this one." : "A draw!");
  }, [over]); // eslint-disable-line react-hooks/exhaustive-deps
  function newGame(lv = level) {
    // Leaving a game halfway counts as a loss
    if (!over && history.length) saveStats({ ...stats, [level]: { ...stats[level], lost: stats[level].lost + 1 } }, lv);
    else if (lv !== level) saveStats(stats, lv);
    setLevel(lv); setS({ board: start(), turn: 0, last: null }); setHistory([]); setRecorded(false); setNote("Your go. Tap one of your cups along the bottom.");
  }
  function undo() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setS(prev); setHistory(history.slice(0, -1)); setNote("Took that back. Your go.");
  }
  const can = s.turn === 0 ? legal(s.board, 0) : [];
  const rec = stats[level];
  const cup = (i: number, mine: boolean) => (
    <button key={i} className={`mc-cup ${can.includes(i) ? "can" : ""} ${s.last === i ? "last" : ""}`} disabled={!mine || !can.includes(i)} onClick={() => move(i)}
      aria-label={`${mine ? "Your" : "Computer's"} cup with ${s.board[i]} bean${s.board[i] === 1 ? "" : "s"}`}>
      <Beans n={s.board[i]} /><b>{s.board[i]}</b>
    </button>
  );
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">a board game</p>
      <h1 className="h2">Bean <em>counting</em></h1>
      <p className="small muted">Mancala against the computer. Tap one of your cups to scoop up its beans and drop them one at a time into the cups to the right, round into your jar and on into the computer&apos;s row. Land your last bean in your jar to go again. Land it in one of your empty cups and you capture the beans opposite. Most beans in the jar at the end wins.</p>
      <div className="row" style={{ gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        {(["easy", "hard"] as const).map((lv) => <button key={lv} className={`chip ${level === lv ? "on" : ""}`} aria-pressed={level === lv} onClick={() => lv !== level && newGame(lv)}>{lv === "easy" ? "Easy" : "Hard"}</button>)}
        <button className="btn btn-ghost btn-sm" onClick={undo} disabled={!history.length || s.turn !== 0}>↩ Undo</button>
        <button className="btn btn-ghost btn-sm" onClick={() => newGame()}>New game</button>
      </div>
      <p className="small center" aria-live="polite" style={{ minHeight: "2.6em" }}>
        {over ? <b>{me > them ? `You win, ${me} to ${them}! 🎉` : me < them ? `The computer wins, ${them} to ${me}.` : `A draw, ${me} each.`}</b> : note}
      </p>
      <div className="mc-board">
        <div className="mc-jar them" aria-label={`Computer's jar: ${them} beans`}><b>{them}</b><span className="tiny">Them</span></div>
        <div className="mc-row top">{[12, 11, 10, 9, 8, 7].map((i) => cup(i, false))}</div>
        <div className="mc-row bottom">{[0, 1, 2, 3, 4, 5].map((i) => cup(i, true))}</div>
        <div className="mc-jar you" aria-label={`Your jar: ${me} beans`}><b>{me}</b><span className="tiny">You</span></div>
      </div>
      <p className="tiny muted center">Beans travel to the right along your row, and to the left along the computer&apos;s.</p>
      {over && <p className="center"><button className="btn btn-pink btn-sm" onClick={() => newGame()}>Play again</button></p>}
      <p className="small muted" style={{ marginTop: "1rem" }}>On {level}: won {rec.won} · lost {rec.lost}{rec.drawn ? ` · drawn ${rec.drawn}` : ""}</p>
      <p className="tiny muted">Easy sometimes slips up. Hard looks seven moves ahead. Your record is kept on this device, and leaving a game halfway counts as a loss.</p>
    </div>
  );
}
