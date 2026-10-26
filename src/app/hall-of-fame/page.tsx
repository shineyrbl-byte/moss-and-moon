import "./page.css";
import type { Metadata } from "next";
import Link from "next/link";
import { hallOfFame, type Winner } from "@/lib/hallOfFame";
import { showClock, showDaily } from "@/lib/scoreFormat";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hall of fame", description: "Who topped every Moss & Moon game board on past days and weeks." };

const dayName = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const weekName = (w: string) => `w/c ${new Date(`${w}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`;

function Row({ w, label, show }: { w: Winner; label: string; show: (v: number) => string }) {
  return (
    <li className={w.name === null ? "hof-empty" : ""}>
      <span className="hof-when">{label}</span>
      {w.name === null ? <span className="muted">no one played</span> : <><span className="hof-name">👑 {w.name}</span><b>{show(w.score)}</b></>}
    </li>
  );
}

export default function HallOfFame() {
  const h = hallOfFame();
  const anyDaily = h.daily.filter((g) => g.winners.some((w) => w.name !== null));
  const anyArcade = h.arcade.filter((g) => g.winners.some((w) => w.name !== null));
  return (
    <div className="page" style={{ maxWidth: "48rem" }}>
      <p className="eyebrow">the games</p>
      <h1 className="h2">Hall of <em>fame</em></h1>
      <p className="small muted">Who came top on every board, for the last {h.dayList.length} days and {h.weekList.length} weeks. Today&apos;s and this week&apos;s boards are still open: you&apos;ll find them on each game.</p>

      <section className="card hof-card">
        <h2 className="h3"><Link href="/puzzle-of-the-week">🗓 Puzzle of the week</Link></h2>
        <ol className="hof-list">{h.weekly.map((w) => <Row key={w.when} w={w} label={weekName(w.when)} show={showClock} />)}</ol>
      </section>

      <h2 className="h3" style={{ marginTop: "1.6rem" }}>Arcade, week by week</h2>
      {anyArcade.length === 0 ? <p className="small muted">No arcade winners yet. Set a score this week and you&apos;ll be first in here next Monday.</p> : (
        <div className="hof-grid">
          {anyArcade.map((g) => (
            <section key={g.id} className="card hof-card">
              <h3><Link href={g.href}>{g.title}</Link></h3>
              <ol className="hof-list">{g.winners.map((w) => <Row key={w.when} w={w} label={weekName(w.when)} show={(v) => `${v.toLocaleString("en-IN")}`} />)}</ol>
            </section>
          ))}
        </div>
      )}

      <h2 className="h3" style={{ marginTop: "1.6rem" }}>Daily puzzles, day by day</h2>
      {anyDaily.length === 0 ? <p className="small muted">No daily winners in the last week yet. Save a score today and you could be the first.</p> : (
        <div className="hof-grid">
          {anyDaily.map((g) => (
            <section key={g.id} className="card hof-card">
              <h3><Link href={g.href}>{g.emoji} {g.title}</Link></h3>
              <ol className="hof-list">{g.winners.map((w) => <Row key={w.when} w={w} label={dayName(w.when)} show={(v) => showDaily(g.id, v)} />)}</ol>
            </section>
          ))}
        </div>
      )}
      <p className="tiny muted" style={{ marginTop: "1.2rem" }}>Puzzles with levels count the usual level. Names are whatever people typed when they saved, so be kind.</p>
    </div>
  );
}
