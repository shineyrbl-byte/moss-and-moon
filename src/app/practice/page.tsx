"use client";
import "./page.css";
import { useEffect, useState } from "react";
import { ARCHIVE_GAMES, PRACTICE_FROM, practiceDay, todayStr } from "@/lib/archive";

export default function Practice() {
  // A different random day for each puzzle, picked in the browser so every visit gets new ones
  const [days, setDays] = useState<Record<string, string>>({});
  useEffect(() => { const t = todayStr(); setDays(Object.fromEntries(ARCHIVE_GAMES.map((g) => [g.id, practiceDay(t)]))); }, []);
  const since = new Date(`${PRACTICE_FROM}T12:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  return (
    <div className="page" style={{ maxWidth: "44rem" }}>
      <p className="eyebrow">the games</p>
      <h1 className="h2">Practice <em>puzzles</em></h1>
      <p className="small muted">Unlimited puzzles to warm up on. Each one is a random old day&apos;s puzzle, from any day since {since}. They don&apos;t go on the boards, count for streaks or touch today&apos;s game, so play as many as you like. Tap <b>Another one</b> on the puzzle for the next.</p>
      <ul className="practice-list">
        {ARCHIVE_GAMES.map((g) => (
          <li key={g.id}>
            <a className="card practice-card" href={days[g.id] ? `${g.href}?practice=1&day=${days[g.id]}` : g.href}>
              <span aria-hidden="true" className="practice-emoji">{g.emoji}</span>
              <span>{g.title}</span>
              <span className="practice-go" aria-hidden="true">🎲</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="small" style={{ marginTop: "1rem" }}>Want the real thing? <a href="/games">Today&apos;s puzzles →</a> · <a href="/puzzle-archive">The last week →</a></p>
    </div>
  );
}
