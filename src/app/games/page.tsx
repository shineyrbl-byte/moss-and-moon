"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { voterId } from "@/components/LabCard";
import { useStore } from "@/components/Store";
import { TROPHIES, earned, type TrophyCtx } from "@/lib/trophies";
import { localTrophyStats } from "@/lib/trophyFlags";
import { ANY_TIME, DAILY_KIND, FAVS_KEY, KIND_LABEL, matches, toggleFav, type Filter, type Kind } from "@/lib/gameCatalog";

type G = { id: string; title: string; emoji: string; href: string; blurb: string; done: boolean; streak: number };
type S = { date: string; games: G[]; done: number; allStreak: number; five: { ids: string[]; done: number; streak: number } };
type AR = { week: string; top: { name: string; games: number }[]; joined: string | null; mine: number; rank: number | null };

export default function Games() {
  const { toast } = useStore();
  const [s, setS] = useState<S | null>(null);
  const [trophies, setTrophies] = useState<number | null>(null);
  const [ar, setAr] = useState<AR | null>(null);
  const [arName, setArName] = useState("");
  const [f, setF] = useState<Filter>({ q: "", kind: "all", quick: false, favs: [] });
  useEffect(() => {
    const v = voterId();
    fetch(`/api/games?voter=${v}`).then((r) => r.json()).then(setS).catch(() => {});
    fetch(`/api/trophies?voter=${v}`).then((r) => r.json()).then((d: Omit<TrophyCtx, "local">) => setTrophies(earned({ ...d, local: localTrophyStats() }).length)).catch(() => {});
    fetch(`/api/all-rounder?voter=${v}`).then((r) => r.json()).then(setAr).catch(() => {});
    try { setArName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    try { const favs = JSON.parse(localStorage.getItem(FAVS_KEY) ?? "[]"); if (Array.isArray(favs)) setF((x) => ({ ...x, favs })); } catch {}
  }, []);
  function star(id: string, title: string) {
    const favs = toggleFav(f.favs, id);
    setF({ ...f, favs });
    try { localStorage.setItem(FAVS_KEY, JSON.stringify(favs)); } catch {}
    toast(favs.includes(id) ? `★ ${title} is in your favourites` : `${title} is out of your favourites`);
  }
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
  const tagged = s.games.map((g) => ({ ...g, ...(DAILY_KIND[g.id] ?? { kind: "logic" as Kind, quick: false }) }));
  const daily = tagged.filter((g) => matches(g, f)), anyTime = ANY_TIME.filter((g) => matches(g, f));
  const filtering = !!f.q.trim() || f.kind !== "all" || f.quick;
  const favs = [...tagged, ...ANY_TIME].filter((g) => f.favs.includes(g.id));
  const Star = ({ id, title }: { id: string; title: string }) => (
    <button type="button" className={`games-star ${f.favs.includes(id) ? "on" : ""}`} onClick={() => star(id, title)} aria-pressed={f.favs.includes(id)} aria-label={`${f.favs.includes(id) ? "Remove" : "Add"} ${title} ${f.favs.includes(id) ? "from" : "to"} favourites`}>{f.favs.includes(id) ? "★" : "☆"}</button>
  );
  return (
    <div className="page" style={{ maxWidth: "52rem" }}>
      <p className="eyebrow">play a while</p>
      <h1 className="h2">Games <em>corner</em></h1>
      <p className="lead">Every daily game in one place. New puzzles every morning, the same for everyone, so you can compare with friends.</p>
      <section className="card explore-hero">
        <div><b className="explore-big">{s.done} <span className="muted">of {s.games.length}</span></b><span className="small muted">played today{s.done === s.games.length ? " · the full set! 🏆" : ""}</span></div>
        <div className="explore-bar" role="progressbar" aria-valuemin={0} aria-valuemax={s.games.length} aria-valuenow={s.done} aria-label="Today's games played"><span style={{ width: `${pct}%` }} /></div>
        {s.allStreak > 0 && <span className="small">🔥 {s.allStreak} day{s.allStreak === 1 ? "" : "s"} in a row with the full set</span>}
        <span className="tiny muted">❄️ Streak freeze: miss a single day once a week and your streaks carry on.</span>
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
      {favs.length > 0 && !filtering && f.kind !== "fav" && (
        <section className="games-favs" aria-labelledby="fav-h">
          <h2 className="h3" id="fav-h" style={{ margin: "0 0 0.4rem" }}>★ Your favourites</h2>
          <ul className="games-more fav">{favs.map((g) => <li key={g.id}><Link href={g.href}><span aria-hidden="true">{g.emoji}</span> {g.title}</Link><Star id={g.id} title={g.title} /></li>)}</ul>
        </section>
      )}
      <section className="games-finder" aria-label="Find a game">
        <label className="field" style={{ marginBottom: 0 }}><span className="sr-only">Search the games</span>
          <input className="input" type="search" placeholder="🔍 Find a game: chess, words, cards…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        </label>
        <div className="games-chips" role="group" aria-label="Kind of game">
          {(["all", "fav", ...Object.keys(KIND_LABEL)] as (Kind | "all" | "fav")[]).map((k) => (
            <button key={k} className={`chip ${f.kind === k ? "on" : ""}`} aria-pressed={f.kind === k} onClick={() => setF({ ...f, kind: k })}>{k === "all" ? "All" : k === "fav" ? `★ Favourites${f.favs.length ? ` (${f.favs.length})` : ""}` : KIND_LABEL[k]}</button>
          ))}
          <button className={`chip ${f.quick ? "on" : ""}`} aria-pressed={f.quick} onClick={() => setF({ ...f, quick: !f.quick })}>⏱ Quick ones</button>
        </div>
        {(filtering || f.kind === "fav") && <p className="tiny muted" role="status" style={{ margin: "0.4rem 0 0" }}>{daily.length + anyTime.length} game{daily.length + anyTime.length === 1 ? "" : "s"} found{daily.length + anyTime.length === 0 ? (f.kind === "fav" ? ". Tap the ☆ on any game to add it here." : ". Try another word or kind.") : ""} <button className="link-btn" onClick={() => setF({ ...f, q: "", kind: "all", quick: false })}>Show everything</button></p>}
      </section>
      {daily.length > 0 && <h2 className="h3" style={{ marginTop: "1rem" }}>Daily games</h2>}
      <ul className="games-grid">
        {daily.map((g) => (
          <li key={g.id} className="games-li">
            <Link href={g.href} className={`card games-tile ${g.done ? "done" : ""}`}>
              <span className="games-emoji" aria-hidden="true">{g.emoji}</span>
              <b>{g.title}</b>
              <span className="tiny muted">{g.blurb}</span>
              <span className="games-status small">{g.done ? "✓ Played today" : "Play →"}{g.streak > 1 ? ` · 🔥 ${g.streak}` : ""}</span>
            </Link>
            <Star id={g.id} title={g.title} />
          </li>
        ))}
      </ul>
      <p className="small" style={{ marginTop: "1rem" }}>Missed a day? <Link href="/puzzle-archive">🗂 Play the last week&apos;s puzzles in the archive →</Link><br />How are you getting on? <Link href="/my-stats">📊 See my puzzle stats →</Link><br />Sound, vibration and colour-blind patterns: <Link href="/game-settings">⚙️ Game settings →</Link><br />Fancy pen and paper? <Link href="/print-puzzles">🖨 Print today&apos;s puzzles →</Link></p>
      {anyTime.length > 0 && <h2 className="h3" style={{ marginTop: "1.6rem" }}>Any time</h2>}
      <ul className="games-more">
        {anyTime.map((g) => (
          <li key={g.id}><Link href={g.href}><span aria-hidden="true">{g.emoji}</span> {g.title}</Link><span className="tiny muted"> · {g.blurb}</span><Star id={g.id} title={g.title} /></li>
        ))}
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
