"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { voterId } from "@/components/LabCard";
import { useStore } from "@/components/Store";
import { TROPHIES, earned, type TrophyCtx } from "@/lib/trophies";
import { localTrophyStats } from "@/lib/trophyFlags";

type G = { id: string; title: string; emoji: string; href: string; blurb: string; done: boolean; streak: number };
type S = { date: string; games: G[]; done: number; allStreak: number; five: { ids: string[]; done: number; streak: number } };
type AR = { week: string; top: { name: string; games: number }[]; joined: string | null; mine: number; rank: number | null };

export default function Games() {
  const { toast } = useStore();
  const [s, setS] = useState<S | null>(null);
  const [trophies, setTrophies] = useState<number | null>(null);
  const [ar, setAr] = useState<AR | null>(null);
  const [arName, setArName] = useState("");
  useEffect(() => {
    const v = voterId();
    fetch(`/api/games?voter=${v}`).then((r) => r.json()).then(setS).catch(() => {});
    fetch(`/api/trophies?voter=${v}`).then((r) => r.json()).then((d: Omit<TrophyCtx, "local">) => setTrophies(earned({ ...d, local: localTrophyStats() }).length)).catch(() => {});
    fetch(`/api/all-rounder?voter=${v}`).then((r) => r.json()).then(setAr).catch(() => {});
    try { setArName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
  }, []);
  async function allRounder(body: Record<string, unknown>) {
    if (body.name) try { localStorage.setItem("mm-game-name", String(body.name)); } catch {}
    const r = await fetch("/api/all-rounder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voter: voterId(), ...body }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setAr(d); toast(body.leave ? "You're off the board." : "You're on the all-rounder board 🥇");
  }
  async function shareFive() {
    if (!s) return;
    const marks = s.five.ids.map((id) => (s.games.find((g) => g.id === id)?.done ? "✅" : "⬜")).join("");
    const text = `Moss & Moon · Today's five · ${s.date}\n${marks}${s.five.streak > 1 ? ` 🔥${s.five.streak}` : ""}`;
    try {
      if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast("Copied. Paste it anywhere 📋"); }
    } catch {}
  }
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
      <section className="card five" aria-labelledby="five-h">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.4rem" }}>
          <h2 className="h3" id="five-h" style={{ margin: 0 }}>🎲 Today&apos;s five</h2>
          <span className="small">{s.five.done}/5{s.five.streak > 0 ? ` · 🔥 ${s.five.streak} day${s.five.streak === 1 ? "" : "s"} in a row` : ""}</span>
        </div>
        <p className="tiny muted" style={{ margin: "0.2rem 0 0.6rem" }}>Not sure where to start? Two word games, two puzzles and a quick one, picked fresh every day.</p>
        <ol className="five-list">
          {s.five.ids.map((id) => { const g = s.games.find((x) => x.id === id); return g && (
            <li key={id}><Link href={g.href} className={g.done ? "done" : ""}><span aria-hidden="true">{g.done ? "✅" : g.emoji}</span> {g.title}</Link></li>
          ); })}
        </ol>
        {s.five.done === 5 ? <p className="small" style={{ margin: "0.6rem 0 0" }}>All five done! 🎉 <button className="btn btn-ghost btn-sm" onClick={shareFive}>Share</button></p>
          : s.five.done > 0 && <p className="tiny" style={{ margin: "0.6rem 0 0" }}><button className="btn btn-ghost btn-sm" onClick={shareFive}>Share so far</button></p>}
      </section>
      <p className="small center" style={{ margin: "0.8rem 0" }}><Link href="/trophies">🏆 Trophy shelf{trophies !== null ? `: ${trophies} of ${TROPHIES.length}` : ""} →</Link></p>
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
      <p className="small" style={{ marginTop: "1rem" }}>Missed a day? <Link href="/puzzle-archive">🗂 Play the last week&apos;s puzzles in the archive →</Link><br />How are you getting on? <Link href="/my-stats">📊 See my puzzle stats →</Link></p>
      <h2 className="h3" style={{ marginTop: "1.6rem" }}>Any time</h2>
      <ul className="games-more">
        <li><Link href="/quiz">🎤 Quiz night</Link><span className="tiny muted"> · when the team hosts one, live on the TV</span></li>
        <li><Link href="/bean-snake">🐍 Bean snake</Link><span className="tiny muted"> · eat the beans, don&apos;t bite your tail</span></li>
        <li><Link href="/call-the-order">⌨️ Call the order</Link><span className="tiny muted"> · type the orders before they run out</span></li>
        <li><Link href="/cafe-patience">🃏 Café patience</Link><span className="tiny muted"> · solitaire with café suits</span></li>
        <li><Link href="/cake-stacker">🎂 Cake stacker</Link><span className="tiny muted"> · how tall can you build it?</span></li>
        <li><Link href="/reversi">⚫ Bean reversi</Link><span className="tiny muted"> · coffee vs milk, against the computer</span></li>
        <li><Link href="/sink-the-saucers">🛸 Sink the saucers</Link><span className="tiny muted"> · battleship with tableware</span></li>
        <li><Link href="/bean-counting">🫘 Bean counting</Link><span className="tiny muted"> · mancala against the computer</span></li>
        <li><Link href="/draughts">⚪ Café draughts</Link><span className="tiny muted"> · checkers against the computer</span></li>
        <li><Link href="/sugar-cubes">🧊 Sugar cubes</Link><span className="tiny muted"> · dots and boxes against the computer</span></li>
        <li><Link href="/cafe-dice">🎲 Café dice</Link><span className="tiny muted"> · five dice, thirteen turns, a weekly board</span></li>
        <li><Link href="/five-in-a-row">⭕ Five in a row</Link><span className="tiny muted"> · gomoku against the computer</span></li>
        <li><Link href="/baristas-echo">🔔 Barista&apos;s echo</Link><span className="tiny muted"> · repeat the café&apos;s sounds, a weekly board</span></li>
        <li><Link href="/bean-breaker">🧱 Bean breaker</Link><span className="tiny muted"> · knock out the sugar cube wall, a weekly board</span></li>
        <li><Link href="/pastry-drop">🥐 Pastry drop</Link><span className="tiny muted"> · fill the rows as the pastries fall, a weekly board</span></li>
        <li><Link href="/saucer-mill">⚪ Saucer mill</Link><span className="tiny muted"> · nine men&apos;s morris against the computer</span></li>
        <li><Link href="/cafe-hearts">♥️ Café hearts</Link><span className="tiny muted"> · the card game, against three computer players</span></li>
        <li><Link href="/delivery-dash">🚲 Delivery dash</Link><span className="tiny muted"> · jump the puddles, duck the awnings, a weekly board</span></li>
        <li><Link href="/tray-pusher">☕ Tray pusher</Link><span className="tiny muted"> · push the cups onto the saucers, 20 levels</span></li>
        <li><Link href="/delivery-jam">🚐 Delivery jam</Link><span className="tiny muted"> · get the cake van out of the yard, 20 levels</span></li>
        <li><Link href="/connect-four">🔴 Guests vs the barista</Link><span className="tiny muted"> · vote on the café&apos;s Connect Four</span></li>
        <li><Link href="/higher-or-lower">💸 Higher or lower</Link><span className="tiny muted"> · which costs more?</span></li>
        <li><Link href="/brew-merge">🌙 Brew merge</Link><span className="tiny muted"> · beans all the way to the moon brew</span></li>
        <li><Link href="/play">☕ Barista rush</Link><span className="tiny muted"> · make the orders, fast</span></li>
        <li><Link href="/bingo">🎯 Coffee bingo</Link><span className="tiny muted"> · a card a month</span></li>
        <li><Link href="/story-chain">📜 Story chain</Link><span className="tiny muted"> · add the next line</span></li>
        <li><Link href="/scoreboard">🏆 Board game scoreboard</Link><span className="tiny muted"> · for the games on our shelf</span></li>
      </ul>
      {ar && (
        <section style={{ marginTop: "1.6rem" }}>
          <h2 className="h3">🥇 This week&apos;s all-rounders</h2>
          <p className="tiny muted" style={{ marginTop: 0 }}>One point for each daily game you finish, each day, Monday to Sunday. It&apos;s about playing a bit of everything, not speed. You&apos;ve finished <b>{ar.mine}</b> this week{ar.rank ? `, ${ar.rank === 1 ? "top of the board" : `number ${ar.rank} on the board`}` : ""}.</p>
          {ar.top.length ? <ol className="memory-board">{ar.top.map((t, i) => <li key={i}><span>{t.name}</span><b>{t.games}</b></li>)}</ol> : <p className="small muted">Nobody on the board yet this week.</p>}
          {ar.joined ? (
            <p className="tiny muted">You&apos;re on the board as <b>{ar.joined}</b>. <button className="link-btn" onClick={() => allRounder({ leave: true })}>Take me off</button></p>
          ) : (
            <div className="row" style={{ alignItems: "end", gap: "0.5rem" }}>
              <label className="field" style={{ maxWidth: "12rem", marginBottom: 0 }}>Name for the board<input className="input" maxLength={20} value={arName} onChange={(e) => setArName(e.target.value)} placeholder="Your name" /></label>
              <button className="btn btn-pink btn-sm" onClick={() => allRounder({ name: arName })}>Join the board</button>
            </div>
          )}
        </section>
      )}
      <p className="tiny muted" style={{ marginTop: "1rem" }}>Signed in? The word, connections, guess the dish, trivia, crack the order and bean hive follow your account. The others are kept in this browser.</p>
    </div>
  );
}
