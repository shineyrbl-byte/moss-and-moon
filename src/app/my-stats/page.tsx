"use client";
import "./page.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import TimeChart from "@/components/TimeChart";
import { voterId } from "@/components/LabCard";
import { clock } from "@/lib/memory";
import { unpackScore } from "@/lib/flood";
import { calendar, type TimeStat } from "@/lib/stats";

type Stats = {
  today: string; days: number; plays: number; longest: number; current: number; first: string | null; busiest: number;
  perDay: Record<string, number>;
  games: { id: string; title: string; emoji: string; href: string; days: number; last: string | null }[];
  times: TimeStat[];
  history?: Record<string, { date: string; ms: number }[]>;
};
const MODE: Record<string, string> = { easy: "easy", medium: "medium", hard: "hard", daily: "" };
/** Flood and Café corners keep moves or words with the time */
function show(game: string, ms: number) {
  if (game === "flood") { const u = unpackScore(ms); return `${u.moves} moves · ${clock(u.ms)}`; }
  if (game === "corners") { const u = unpackScore(ms); return `${u.moves} words · ${clock(u.ms)}`; } // packed the same way as Flood
  return clock(ms);
}
const level = (n: number) => (n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : 3);
const nice = (d: string, o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", o);

export default function MyStats() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState(false);
  const [pick, setChartGame] = useState("");
  useEffect(() => { fetch(`/api/my-stats?voter=${voterId()}`).then((r) => r.json()).then(setS).catch(() => setErr(true)); }, []);
  if (err) return <div className="page"><p className="muted">Couldn&apos;t load your stats. Try again in a moment.</p></div>;
  if (!s) return <div className="page"><p className="muted">Adding it all up…</p></div>;
  const weeks = calendar(s.perDay, s.today);
  const played = s.games.filter((g) => g.days).sort((a, b) => b.days - a.days || a.title.localeCompare(b.title));
  const not = s.games.filter((g) => !g.days);
  // Puzzles with at least three days of times can be charted
  const charted = played.filter((g) => (s.history?.[g.id]?.length ?? 0) >= 3);
  const chartGame = charted.some((g) => g.id === pick) ? pick : charted[0]?.id ?? "";
  const timesFor = (id: string) => s.times.filter((t) => t.game === id).sort((a, b) => a.mode.localeCompare(b.mode));
  return (
    <div className="page" style={{ maxWidth: "44rem" }}>
      <p className="eyebrow">just for you</p>
      <h1 className="h2">My puzzle <em>stats</em></h1>
      <p className="small muted">Everything you&apos;ve played across the daily games, from this browser{s.first ? `, since ${nice(s.first, { day: "numeric", month: "long", year: "numeric" })}` : ""}. Signed in, the word, connections and other server games count you by your account.</p>
      <div className="st-tiles">
        <div><b>{s.days}</b><span>days played</span></div>
        <div><b>{s.plays}</b><span>puzzles finished</span></div>
        <div><b>{s.current}</b><span>days in a row now</span></div>
        <div><b>{s.longest}</b><span>longest run</span></div>
      </div>
      <h2 className="h3" style={{ marginTop: "1.4rem" }}>The last 12 weeks</h2>
      <div className="st-cal-wrap">
        <div className="st-days" aria-hidden="true"><span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span /><span>Sun</span></div>
        <div className="st-cal" role="table" aria-label="Puzzles played each day, the last 12 weeks">
          {weeks.map((w, i) => (
            <div key={i} className="st-week" role="row">
              {w.map((d) => (
                <span key={d.date} role="cell" className={`st-day l${level(d.n)} ${d.future ? "future" : ""} ${d.date === s.today ? "today" : ""}`}
                  title={d.future ? "" : `${nice(d.date, { weekday: "short", day: "numeric", month: "short" })}: ${d.n} puzzle${d.n === 1 ? "" : "s"}`}
                  aria-label={d.future ? "" : `${nice(d.date, { weekday: "long", day: "numeric", month: "long" })}: ${d.n} puzzle${d.n === 1 ? "" : "s"}`} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="st-legend tiny muted" aria-hidden="true">Fewer <i className="st-day l0" /><i className="st-day l1" /><i className="st-day l2" /><i className="st-day l3" /> more · 1–2, 3–5, 6 or more puzzles{s.busiest ? ` · your busiest day: ${s.busiest}` : ""}</p>
      {charted.length > 0 && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">Your times over time</h2>
          <label className="field" style={{ maxWidth: "18rem" }}>Puzzle
            <select className="input" value={chartGame} onChange={(e) => setChartGame(e.target.value)}>{charted.map((g) => <option key={g.id} value={g.id}>{g.emoji} {g.title}</option>)}</select>
          </label>
          <TimeChart key={chartGame} game={chartGame} points={s.history![chartGame]} />
        </section>
      )}
      <h2 className="h3" style={{ marginTop: "1.4rem" }}>Puzzle by puzzle</h2>
      {played.length ? (
        <div className="st-table-wrap">
          <table className="st-table">
            <thead><tr><th scope="col">Puzzle</th><th scope="col">Days</th><th scope="col">Best</th><th scope="col">Typical</th></tr></thead>
            <tbody>
              {played.map((g) => {
                const ts = timesFor(g.id);
                return (
                  <tr key={g.id}>
                    <th scope="row"><Link href={g.href}><span aria-hidden="true">{g.emoji}</span> {g.title}</Link>{g.last ? <small className="muted"> · last {nice(g.last)}</small> : null}</th>
                    <td>{g.days}</td>
                    <td>{ts.length ? ts.map((t) => <span key={t.mode} className="st-time">{show(g.id, t.best)}{MODE[t.mode] ? <small className="muted"> {MODE[t.mode]}</small> : null}</span>) : <span className="muted">no time</span>}</td>
                    <td>{ts.length ? ts.map((t) => <span key={t.mode} className="st-time">{show(g.id, t.typical)}{t.n > 1 ? <small className="muted"> of {t.n}</small> : null}</span>) : <span className="muted">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="small muted">Nothing yet. <Link href="/games">Pick a daily game</Link> and your stats start here.</p>}
      <p className="tiny muted">&quot;Typical&quot; is your middle time: half your games were quicker, half slower. Times only count once you save them to the board, and puzzles from the archive aren&apos;t counted.</p>
      {not.length > 0 && <p className="small" style={{ marginTop: "1rem" }}>Not tried yet: {not.map((g, i) => <span key={g.id}>{i ? ", " : ""}<Link href={g.href}>{g.title}</Link></span>)}</p>}
    </div>
  );
}
