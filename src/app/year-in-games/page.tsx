"use client";
import "./page.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { TROPHIES, earned, type TrophyCtx } from "@/lib/trophies";
import { localTrophyStats } from "@/lib/trophyFlags";
import { showDaily } from "@/lib/scoreFormat";

type Y = {
  name: string | null; from: string; solved: number; days: number; longest: number; weeks: number; tournaments: number;
  games: { id: string; title: string; emoji: string; href: string; times: number; best: number | null }[];
  months: { month: string; n: number }[]; arcade: { id: string; title: string; href: string; best: number }[];
};

export default function YearInGames() {
  const { toast } = useStore();
  const [y, setY] = useState<Y | null>(null);
  const [trophies, setTrophies] = useState<number | null>(null);
  useEffect(() => {
    const v = voterId();
    fetch(`/api/year-in-games?voter=${v}`).then((r) => r.json()).then(setY).catch(() => {});
    fetch(`/api/trophies?voter=${v}`).then((r) => r.json()).then((d: Omit<TrophyCtx, "local">) => setTrophies(earned({ ...d, local: localTrophyStats() }).length)).catch(() => {});
  }, []);
  if (!y) return <div className="page"><p className="muted">Adding up your year…</p></div>;
  const since = new Date(`${y.from}T12:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  if (!y.solved && !y.arcade.length) return (
    <div className="page narrow center">
      <span style={{ fontSize: "3rem" }} aria-hidden="true">🎮</span>
      <h1 className="h2">Your year in <em>games</em></h1>
      <p className="lead">Nothing on the boards since {since} yet. Save a score on any daily puzzle or arcade game and this page starts filling up.</p>
      <Link className="btn btn-pink" href="/games">To the games corner</Link>
    </div>
  );
  const top = y.games[0], peak = Math.max(1, ...y.months.map((m) => m.n)), busiest = y.months.reduce((a, b) => (b.n > a.n ? b : a));
  async function share() {
    const text = `My year in games at Moss & Moon: ${y!.solved} puzzles solved on ${y!.days} days, a best run of ${y!.longest} day${y!.longest === 1 ? "" : "s"}${top ? `, and ${top.title} was my favourite` : ""} ☕🧩`;
    try { if (navigator.share) await navigator.share({ text, url: `${location.origin}/games` }); else { await navigator.clipboard.writeText(text); toast("Copied, ready to paste 📋"); } } catch {}
  }
  const s = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const stats: [string, string][] = [[`${y.solved}`, s(y.solved, "puzzle solved", "puzzles solved")], [`${y.days}`, s(y.days, "day you played", "days you played")], [`${y.longest}`, s(y.longest, "day in a row, at best", "days in a row, at best")], [trophies === null ? "…" : `${trophies}/${TROPHIES.length}`, "trophies"], [`${y.weeks}`, s(y.weeks, "weekly puzzle done", "weekly puzzles done")], [`${y.tournaments}`, s(y.tournaments, "tournament played", "tournaments played")]];
  return (
    <div className="page" style={{ maxWidth: "48rem" }}>
      <p className="eyebrow">since {since}</p>
      <h1 className="h2">{y.name ? `${y.name}, your` : "Your"} year in <em>games</em></h1>
      <div className="yg-stats">{stats.map(([n, l]) => <div key={l} className="card yg-stat"><b>{n}</b><span className="small muted">{l}</span></div>)}</div>
      {top && <p className="card yg-fav">Your favourite: <b>{top.emoji} {top.title}</b>, {top.times} time{top.times === 1 ? "" : "s"}{top.best !== null ? `, best ${showDaily(top.id, top.best)}` : ""}.</p>}
      <section style={{ marginTop: "1.4rem" }}>
        <h2 className="h3">Puzzles, month by month</h2>
        <p className="small muted">Busiest: {busiest.month}, with {busiest.n}.</p>
        <div className="yg-bars" role="list">
          {y.months.map((m, k) => (
            <div key={k} className="yg-bar" role="listitem" aria-label={`${m.month}: ${m.n} puzzle${m.n === 1 ? "" : "s"}`}>
              <span className="yg-n" aria-hidden="true">{m.n || ""}</span>
              <span className="yg-track" aria-hidden="true"><i style={{ height: `${(m.n / peak) * 100}%` }} /></span>
              <span className="yg-m" aria-hidden="true">{m.month}</span>
            </div>
          ))}
        </div>
      </section>
      <section style={{ marginTop: "1.4rem" }}>
        <h2 className="h3">Every puzzle you played</h2>
        <table className="yg-table">
          <thead><tr><th scope="col">Puzzle</th><th scope="col">Times</th><th scope="col">Your best</th></tr></thead>
          <tbody>{y.games.map((g) => <tr key={g.id}><td><Link href={g.href}>{g.emoji} {g.title}</Link></td><td>{g.times}</td><td>{g.best !== null ? showDaily(g.id, g.best) : "–"}</td></tr>)}</tbody>
        </table>
      </section>
      {y.arcade.length > 0 && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">Arcade bests</h2>
          <ul className="yg-arcade">{y.arcade.map((a) => <li key={a.id}><Link href={a.href}>{a.title}</Link><b>{a.best.toLocaleString("en-IN")}</b></li>)}</ul>
        </section>
      )}
      <div className="row" style={{ gap: "0.5rem", marginTop: "1.4rem", flexWrap: "wrap" }}>
        <button className="btn btn-pink btn-sm" onClick={share}>📤 Share my year</button>
        <Link className="btn btn-ghost btn-sm" href="/year">☕ My year in coffee</Link>
        <Link className="btn btn-ghost btn-sm" href="/my-stats">📊 Puzzle stats</Link>
      </div>
      <p className="tiny muted" style={{ marginTop: "1rem" }}>Counts the scores you saved on the boards, from this browser{y.name ? " and the others linked to your account" : ""}. Bests are at each puzzle&apos;s usual level.</p>
    </div>
  );
}
