"use client";
import { useEffect, useState } from "react";
import { ARCHIVE_GAMES, finishedOn, pastDays, todayStr } from "@/lib/archive";

const short = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
const long = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

export default function PuzzleArchive() {
  const [days, setDays] = useState<string[]>([]);
  const [day, setDay] = useState("");
  const [done, setDone] = useState<Record<string, Set<string>>>({});
  useEffect(() => {
    const ds = pastDays(todayStr());
    setDays(ds); setDay(ds[0]);
    try {
      const keys = Object.keys(localStorage), get = (k: string) => localStorage.getItem(k);
      setDone(Object.fromEntries(ds.map((d) => [d, new Set(ARCHIVE_GAMES.filter((g) => finishedOn(g.key, d, keys, get)).map((g) => g.id))])));
    } catch {}
  }, []);
  if (!day) return <div className="page"><p className="muted">Dusting off the old puzzles…</p></div>;
  const mine = done[day] ?? new Set<string>();
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">missed a day?</p>
      <h1 className="h2">Puzzle <em>archive</em></h1>
      <p className="small muted">Play any of the last week&apos;s daily puzzles. They&apos;re just for fun: past days don&apos;t go on the boards or count towards streaks, and your progress on them is kept separately, so today&apos;s game is never touched.</p>
      <div className="ar-days" role="tablist" aria-label="Day">
        {days.map((d) => (
          <button key={d} role="tab" aria-selected={d === day} className={`chip ${d === day ? "on" : ""}`} onClick={() => setDay(d)}>
            {short(d)}{done[d]?.size ? <span className="ar-count"> · {done[d].size}✓</span> : null}
          </button>
        ))}
      </div>
      <h2 className="h3" style={{ marginTop: "1rem" }}>{long(day)}</h2>
      <p className="tiny muted">{mine.size} of {ARCHIVE_GAMES.length} done</p>
      <ul className="ar-games">
        {ARCHIVE_GAMES.map((g) => (
          <li key={g.id}>
            {/* A full page load, so each puzzle reads the day from the address */}
            <a href={`${g.href}?day=${day}`} className={mine.has(g.id) ? "done" : ""}>
              <span aria-hidden="true">{g.emoji}</span> {g.title}
              <span className="ar-tick">{mine.has(g.id) ? "✓ Done" : "Play →"}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="tiny muted">The word, connections, trivia and other puzzles that are kept on our server aren&apos;t in the archive, but Bean hive shows yesterday&apos;s answers.</p>
    </div>
  );
}
