"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { voterId } from "@/components/LabCard";

type G = { id: string; title: string; emoji: string; href: string; blurb: string; done: boolean; streak: number };
type S = { date: string; games: G[]; done: number; allStreak: number };

export default function Games() {
  const [s, setS] = useState<S | null>(null);
  useEffect(() => { fetch(`/api/games?voter=${voterId()}`).then((r) => r.json()).then(setS).catch(() => {}); }, []);
  if (!s) return <div className="page"><p className="muted">Setting out the games…</p></div>;
  const pct = Math.round((s.done / s.games.length) * 100);
  return (
    <div className="page" style={{ maxWidth: "52rem" }}>
      <p className="eyebrow">play a while</p>
      <h1 className="h2">Games <em>corner</em></h1>
      <p className="lead">Every daily game in one place. New puzzles every morning, the same for everyone, so you can compare with friends.</p>
      <section className="card explore-hero">
        <div><b className="explore-big">{s.done} <span className="muted">of {s.games.length}</span></b><span className="small muted">played today{s.done === s.games.length ? " · the full set! 🏆" : ""}</span></div>
        <div className="explore-bar" role="progressbar" aria-valuemin={0} aria-valuemax={s.games.length} aria-valuenow={s.done} aria-label="Today's games played"><span style={{ width: `${pct}%` }} /></div>
        {s.allStreak > 0 && <span className="small">🔥 {s.allStreak} day{s.allStreak === 1 ? "" : "s"} in a row with the full set</span>}
      </section>
      <ul className="games-grid">
        {s.games.map((g) => (
          <li key={g.id}>
            <Link href={g.href} className={`card games-tile ${g.done ? "done" : ""}`}>
              <span className="games-emoji" aria-hidden="true">{g.emoji}</span>
              <b>{g.title}</b>
              <span className="tiny muted">{g.blurb}</span>
              <span className="games-status small">{g.done ? "✓ Played today" : "Play →"}{g.streak > 1 ? ` · 🔥 ${g.streak}` : ""}</span>
            </Link>
          </li>
        ))}
      </ul>
      <h2 className="h3" style={{ marginTop: "1.6rem" }}>Any time</h2>
      <ul className="games-more">
        <li><Link href="/quiz">🎤 Quiz night</Link><span className="tiny muted"> · when the team hosts one, live on the TV</span></li>
        <li><Link href="/bean-snake">🐍 Bean snake</Link><span className="tiny muted"> · eat the beans, don&apos;t bite your tail</span></li>
        <li><Link href="/call-the-order">⌨️ Call the order</Link><span className="tiny muted"> · type the orders before they run out</span></li>
        <li><Link href="/cafe-patience">🃏 Café patience</Link><span className="tiny muted"> · solitaire with café suits</span></li>
        <li><Link href="/cake-stacker">🎂 Cake stacker</Link><span className="tiny muted"> · how tall can you build it?</span></li>
        <li><Link href="/reversi">⚫ Bean reversi</Link><span className="tiny muted"> · coffee vs milk, against the computer</span></li>
        <li><Link href="/sink-the-saucers">🛸 Sink the saucers</Link><span className="tiny muted"> · battleship with tableware</span></li>
        <li><Link href="/connect-four">🔴 Guests vs the barista</Link><span className="tiny muted"> · vote on the café&apos;s Connect Four</span></li>
        <li><Link href="/higher-or-lower">💸 Higher or lower</Link><span className="tiny muted"> · which costs more?</span></li>
        <li><Link href="/brew-merge">🌙 Brew merge</Link><span className="tiny muted"> · beans all the way to the moon brew</span></li>
        <li><Link href="/play">☕ Barista rush</Link><span className="tiny muted"> · make the orders, fast</span></li>
        <li><Link href="/bingo">🎯 Coffee bingo</Link><span className="tiny muted"> · a card a month</span></li>
        <li><Link href="/story-chain">📜 Story chain</Link><span className="tiny muted"> · add the next line</span></li>
        <li><Link href="/scoreboard">🏆 Board game scoreboard</Link><span className="tiny muted"> · for the games on our shelf</span></li>
      </ul>
      <p className="tiny muted" style={{ marginTop: "1rem" }}>Signed in? The word, connections, guess the dish, trivia, crack the order and bean hive follow your account. The others are kept in this browser.</p>
    </div>
  );
}
