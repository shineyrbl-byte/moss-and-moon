"use client";
import "./page.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { showDaily } from "@/lib/scoreFormat";
import { addFlag } from "@/lib/trophyFlags";

type D = { game: string; title: string; emoji: string; href: string; date: string; opponent: string; result: "on" | "won" | "lost" | "drawn"; mine: number | null; theirs: number | null };
type R = { today: D[]; recent: D[]; record: { won: number; lost: number; drawn: number }; options: { id: string; title: string; emoji: string; href: string; players: number }[] };
const WORD = { won: "You won 🎉", lost: "They won", drawn: "A draw", on: "On: play it and save your score" };

export default function DailyDuel() {
  const { toast } = useStore();
  const [r, setR] = useState<R | null>(null);
  const load = () => fetch(`/api/duels?voter=${voterId()}`).then((x) => x.json()).then((d: R) => { setR(d); if (d.record.won >= 5) addFlag("duel-five"); }).catch(() => {});
  useEffect(() => { void load(); }, []);
  async function start(game: string) {
    const x = await fetch("/api/duels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voter: voterId(), game }) });
    const d = await x.json();
    if (!x.ok) return toast(d.error);
    toast("Duel on! Their score's hidden until you save yours ⚔️"); void load();
  }
  if (!r) return <div className="page"><p className="muted">Finding you an opponent…</p></div>;
  const inDuel = new Set(r.today.map((d) => d.game));
  return (
    <div className="page" style={{ maxWidth: "36rem" }}>
      <p className="eyebrow">play with people</p>
      <h1 className="h2">Daily <em>duel</em></h1>
      <p className="small muted">Race a stranger on today&apos;s puzzle. Pick one and we&apos;ll pair you with someone who&apos;s already saved a score on it. Their score stays hidden until you save yours, then it&apos;s a win, a loss or a draw.</p>
      <p className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>Won <b>{r.record.won}</b></span><span>Lost <b>{r.record.lost}</b></span><span>Drawn <b>{r.record.drawn}</b></span></p>
      {r.today.length > 0 && (
        <section><h2 className="h3">Today&apos;s duels</h2>
          <ul className="dd-list">{r.today.map((d) => (
            <li key={d.game} className={`card dd-duel ${d.result}`}>
              <span className="dd-title">{d.emoji} {d.title} <span className="small muted">vs {d.opponent}</span></span>
              <b>{WORD[d.result]}</b>
              {d.result === "on" ? <Link className="btn btn-pink btn-sm" href={d.href}>Play it →</Link> : <span className="small">You {showDaily(d.game, d.mine!)} · them {showDaily(d.game, d.theirs!)}</span>}
            </li>))}
          </ul>
          <button className="btn btn-ghost btn-sm" onClick={() => load()}>Check results</button>
        </section>
      )}
      <h2 className="h3" style={{ marginTop: "1.2rem" }}>Start a duel</h2>
      {r.options.filter((o) => !inDuel.has(o.id)).length === 0 ? <p className="small muted">Nobody else has saved a score on a puzzle you haven&apos;t done yet today. Check back later.</p> : (
        <ul className="dd-opts">{r.options.filter((o) => !inDuel.has(o.id)).map((o) => <li key={o.id}><button className="card dd-opt" onClick={() => start(o.id)}><span aria-hidden="true">{o.emoji}</span> {o.title}<span className="tiny muted">{o.players} to race</span></button></li>)}</ul>
      )}
      {r.recent.length > 0 && <><h2 className="h3" style={{ marginTop: "1.2rem" }}>Recent</h2><ul className="dd-recent">{r.recent.map((d, k) => <li key={k}>{d.emoji} {d.title} vs {d.opponent} · <b>{WORD[d.result]}</b> <span className="tiny muted">{d.date}</span></li>)}</ul></>}
      <p className="tiny muted" style={{ marginTop: "1rem" }}>Only puzzles you haven&apos;t saved today can be duelled. A duel you don&apos;t finish by midnight counts as a loss.</p>
    </div>
  );
}
