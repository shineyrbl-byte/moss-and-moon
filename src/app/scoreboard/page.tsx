"use client";
import "./page.css";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";

type Game = { id: string; kind: string; title: string; detail: string; out: number };
type Overall = { top: { id: string; title: string; plays: number }[]; recent: { id: number; game_id: string; title: string; winner: string; players: number; created_at: string }[]; month: number };
type One = { game: { id: string; title: string; detail: string }; plays: number; month: { name: string; wins: number }[]; allTime: { name: string; wins: number }[] };
const ago = (t: string) => new Date(t.replace(" ", "T")).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default function Scoreboard() {
  const { toast } = useStore();
  const [games, setGames] = useState<Game[]>([]);
  const [all, setAll] = useState<Overall | null>(null);
  const [pick, setPick] = useState("");
  const [one, setOne] = useState<One | null>(null);
  const [f, setF] = useState({ winner: "", players: "2" });
  const [busy, setBusy] = useState(false);
  const loadAll = useCallback(() => fetch("/api/game-plays").then((r) => r.json()).then(setAll).catch(() => {}), []);
  useEffect(() => {
    fetch("/api/shelf").then((r) => r.json()).then((d) => setGames((d.items as Game[]).filter((i) => i.kind === "game"))).catch(() => {});
    loadAll();
    const g = new URLSearchParams(location.search).get("game");
    if (g) setPick(g);
  }, [loadAll]);
  useEffect(() => { if (pick) fetch(`/api/game-plays?game=${encodeURIComponent(pick)}`).then((r) => (r.ok ? r.json() : null)).then(setOne).catch(() => {}); else setOne(null); }, [pick]);
  async function log(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/game-plays", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game: pick, winner: f.winner, players: Number(f.players), voter: voterId() }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast(d.error ?? "That didn't save. Try again?");
    setOne(d.board); loadAll(); setF({ ...f, winner: "" });
    toast(`🏆 Well played, ${f.winner}!`);
  }
  return (
    <div className="page" style={{ maxWidth: "48rem" }}>
      <p className="eyebrow">bragging rights</p>
      <h1 className="h2">Board game <em>scoreboard</em></h1>
      <p className="lead">Played something from the <Link href="/shelf" className="link-btn">shelf</Link>? Tell us who won. Every game keeps its own champions.</p>
      <form className="card score-form" onSubmit={log}>
        <label className="field">Game
          <select className="input" required value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Pick a game…</option>
            {games.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </label>
        <div className="row" style={{ alignItems: "end", flexWrap: "wrap" }}>
          <label className="field" style={{ maxWidth: "12rem" }}>Who won?<input className="input" maxLength={20} required value={f.winner} onChange={(e) => setF({ ...f, winner: e.target.value })} placeholder="First name" /></label>
          <label className="field" style={{ maxWidth: "7rem" }}>Players<input className="input" type="number" min={1} max={12} required value={f.players} onChange={(e) => setF({ ...f, players: e.target.value })} /></label>
          <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} disabled={busy || !pick}>{busy ? "Saving…" : "Log the win"}</button>
        </div>
      </form>
      {one && (
        <section style={{ marginTop: "1.2rem" }}>
          <h2 className="h3">🏆 {one.game.title} <span className="muted small">· {one.plays} game{one.plays === 1 ? "" : "s"} logged</span></h2>
          <div className="score-cols">
            <div><h3 className="small muted">This month</h3>{one.month.length ? <ol className="memory-board">{one.month.map((w, i) => <li key={i}><span>{i === 0 ? "👑 " : ""}{w.name}</span><b>{w.wins} win{w.wins === 1 ? "" : "s"}</b></li>)}</ol> : <p className="small muted">No wins yet this month.</p>}</div>
            <div><h3 className="small muted">All time</h3>{one.allTime.length ? <ol className="memory-board">{one.allTime.map((w, i) => <li key={i}><span>{w.name}</span><b>{w.wins} win{w.wins === 1 ? "" : "s"}</b></li>)}</ol> : <p className="small muted">Be the first champion.</p>}</div>
          </div>
        </section>
      )}
      {all && (
        <section style={{ marginTop: "1.4rem" }}>
          <h2 className="h3">Most played this month <span className="muted small">· {all.month} game{all.month === 1 ? "" : "s"}</span></h2>
          {all.top.length ? <ol className="memory-board">{all.top.map((g) => <li key={g.id}><button className="link-btn" onClick={() => setPick(g.id)}>{g.title}</button><b>{g.plays}×</b></li>)}</ol> : <p className="small muted">Nothing logged yet this month. Grab a game!</p>}
          {all.recent.length > 0 && (
            <>
              <h3 className="small muted" style={{ marginTop: "1rem" }}>Latest wins</h3>
              <ul className="score-recent">{all.recent.map((p) => <li key={p.id} className="small"><b>{p.winner}</b> won {p.title} <span className="muted">· {p.players} playing · {ago(p.created_at)}</span></li>)}</ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}
