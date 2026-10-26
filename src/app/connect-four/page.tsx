"use client";
import "./page.css";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { COLS, ROWS } from "@/lib/connect4";

type S = {
  game: number; board: number[]; status: string; moves: number; roundEnds: number | null; counts: number[]; mine: number | null;
  open: number[]; lastGuest: number | null; lastBot: number | null; win: number[]; nextGame: number | null;
  score: { guests: number; barista: number; draws: number };
};
const mins = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return s >= 60 ? `${Math.ceil(s / 60)} min` : `${s}s`; };

export default function ConnectFour() {
  const { toast } = useStore();
  const [s, setS] = useState<S | null>(null);
  const [now, setNow] = useState(Date.now());
  const load = useCallback(() => fetch(`/api/connect4?voter=${voterId()}`).then((r) => r.json()).then(setS).catch(() => {}), []);
  useEffect(() => { load(); const a = setInterval(load, 20_000), b = setInterval(() => setNow(Date.now()), 1000); return () => { clearInterval(a); clearInterval(b); }; }, [load]);
  // When a round's time is up, check straight away for the moves
  useEffect(() => { if (s?.roundEnds && now >= s.roundEnds + 500) load(); }, [now >= (s?.roundEnds ?? Infinity) + 500]); // eslint-disable-line react-hooks/exhaustive-deps
  async function vote(col: number) {
    const r = await fetch("/api/connect4", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ col, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setS(d); toast(`Vote in for column ${col + 1} 🔴`);
  }
  if (!s) return <div className="page"><p className="muted">Setting up the board…</p></div>;
  const playing = s.status === "playing";
  const total = s.counts.reduce((a, b) => a + b, 0);
  const result = s.status === "guests" ? "🎉 The guests win!" : s.status === "barista" ? "☕ The barista wins this one." : s.status === "draw" ? "🤝 It's a draw." : null;
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">everyone vs the counter</p>
      <h1 className="h2">Guests vs the <em>barista</em></h1>
      <p className="small muted">One big game of Connect Four for the whole café. You&apos;re 🔴, the barista is 🟡. Vote where the next counter goes: when the round closes, the most popular column is played and the barista replies.</p>
      <div className="c4-score" aria-label="Score so far"><span>🔴 Guests <b>{s.score.guests}</b></span><span>🟡 Barista <b>{s.score.barista}</b></span>{s.score.draws > 0 && <span>🤝 <b>{s.score.draws}</b></span>}</div>
      <p className="small center" aria-live="polite" style={{ minHeight: "1.4em" }}>
        {result ?? (s.roundEnds ? <>Round closes in <b>{mins(s.roundEnds - now)}</b> · {total} vote{total === 1 ? "" : "s"}</> : <>Game {s.game} · the round starts with the first vote</>)}
      </p>
      <div className="c4-wrap">
        {playing && (
          <div className="c4-cols" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
            {[...Array(COLS).keys()].map((c) => (
              <button key={c} className={`c4-vote ${s.mine === c ? "on" : ""}`} disabled={!s.open.includes(c)} onClick={() => vote(c)} aria-pressed={s.mine === c} aria-label={`Vote for column ${c + 1}${s.counts[c] ? `, ${s.counts[c]} votes so far` : ""}`}>
                <span aria-hidden="true">▼</span>{s.counts[c] > 0 && <span className="c4-count">{s.counts[c]}</span>}
              </button>
            ))}
          </div>
        )}
        <div className="c4-board" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }} role="img" aria-label={`Board after ${s.moves} rounds`}>
          {s.board.map((v, i) => {
            const r = Math.floor(i / COLS), c = i % COLS;
            const top = (col: number | null) => col !== null && c === col && s.board.findIndex((x, k) => k % COLS === col && x !== 0) === i;
            return <span key={i} className={`c4-hole ${v === 1 ? "red" : v === 2 ? "yellow" : ""} ${s.win.includes(i) ? "win" : ""} ${(v === 1 && top(s.lastGuest)) || (v === 2 && top(s.lastBot)) ? "last" : ""}`} data-r={r} />;
          })}
        </div>
      </div>
      {s.lastGuest !== null && playing && <p className="tiny muted center">Last round: guests played column {s.lastGuest + 1}{s.lastBot !== null ? `, the barista answered in column ${s.lastBot + 1}` : ""}.</p>}
      {!playing && s.nextGame && <p className="small center">A new game starts in {mins(s.nextGame - now)}.</p>}
      <p className="tiny muted center" style={{ marginTop: "1rem" }}>One vote per round each, and you can change it. {ROWS * COLS / 2} rounds at most. It&apos;s on the screen by the counter too.</p>
    </div>
  );
}
