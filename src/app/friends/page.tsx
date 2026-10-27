"use client";
import "./page.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { clock } from "@/lib/memory";
import { scoreText } from "@/lib/scoreText";
import { AVATARS, SHOWCASE_MAX } from "@/lib/profiles";
import { TROPHIES, earned, type TrophyCtx } from "@/lib/trophies";
import { localTrophyStats } from "@/lib/trophyFlags";
import { ANY_TIME } from "@/lib/gameCatalog";

type R3 = { won: number; lost: number; drawn: number };
type Person = { code: string; name: string; avatar: string; me: boolean; played: number; times: Record<string, number>; weekly: number | null; h2h: R3 | null };
type Feed = { name: string; code: string; avatar: string; game: { id: string; title: string; emoji: string; href: string }; date: string; ms: number };
type Me = { code: string; name: string; avatar: string; fav: string; showcase: string[] };
type Board = { me: Me | null; people: Person[]; feed?: Feed[]; games: { id: string; title: string; emoji: string }[]; today: string; week: string ; league?: { name: string; me: boolean; points: number; solved: number; bests: number }[] };

const prevDay = (d: string) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };

export default function Friends() {
  const { toast } = useStore();
  const [b, setB] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [mine, setMine] = useState<string[]>([]); // trophies you've earned, for the showcase
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    // A link like /friends?add=CODE fills the box in
    const c = new URLSearchParams(location.search).get("add");
    if (c) setCode(c.toUpperCase().slice(0, 6));
    fetch(`/api/friends?voter=${voterId()}`).then((r) => r.json()).then(setB).catch(() => {});
    fetch(`/api/trophies?voter=${voterId()}`).then((r) => r.json()).then((d: Omit<TrophyCtx, "local">) => setMine(earned({ ...d, local: localTrophyStats() }))).catch(() => {});
  }, []);
  const saveProfile = (p: Partial<Me>) => b?.me && post({ profile: { avatar: b.me.avatar, fav: b.me.fav, showcase: b.me.showcase, ...p } });
  async function post(body: Record<string, unknown>, done?: string) {
    const r = await fetch("/api/friends", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voter: voterId(), ...body }) });
    const d = await r.json();
    if (!r.ok) { toast(d.error); return false; }
    setB(d); if (done) toast(done);
    return true;
  }
  async function share() {
    if (!b?.me) return;
    const text = `Add me on the Moss & Moon games: my friend code is ${b.me.code}`;
    const url = `${location.origin}/friends?add=${b.me.code}`;
    try { if (navigator.share) await navigator.share({ text, url }); else { await navigator.clipboard.writeText(`${text}\n${url}`); toast("Copied, ready to send 📋"); } } catch {}
  }
  if (!b) return <div className="page"><p className="muted">Pulling up chairs…</p></div>;
  const others = b.people.filter((p) => !p.me);
  const games = b.games.filter((g) => b.people.some((p) => p.times[g.id] !== undefined));
  // Lower is better for every game here (boggle stores "1,000,000 minus points")
  const best = (id: string) => Math.min(...b.people.map((p) => p.times[id] ?? Infinity));
  const key = (p: Person) => p.code || "me";
  return (
    <div className="page" style={{ maxWidth: "48rem" }}>
      <p className="eyebrow">games corner</p>
      <h1 className="h2">Friends <em>board</em></h1>
      <p className="small muted">Swap friend codes and see how you each did on today&apos;s puzzles and the puzzle of the week. Friends only see the name you pick, your saved times and the profile you choose (a picture, a favourite game and up to three trophies), nothing else.</p>
      <section className="card fr-me">
        {b.me ? (
          <>
            <span className="small">Your friend code</span>
            <b className="fr-code">{b.me.code}</b>
            <span className="small muted">Friends see you as <b>{b.me.avatar} {b.me.name}</b></span>
            <span className="row" style={{ gap: "0.4rem", justifyContent: "center", flexWrap: "wrap" }}>
              <button className="btn btn-pink btn-sm" onClick={share}>📤 Send my code</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(!editing)} aria-expanded={editing}>✏️ My profile</button>
              <Link className="btn btn-ghost btn-sm" href={`/profile?code=${b.me.code}`}>👀 See it</Link>
            </span>
          </>
        ) : (
          <div className="row" style={{ alignItems: "end", gap: "0.5rem", flexWrap: "wrap" }}>
            <label className="field" style={{ marginBottom: 0, maxWidth: "14rem" }}>Your name for friends<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Asha" /></label>
            <button className="btn btn-pink btn-sm" onClick={() => post({ name }, "Here's your friend code 🎉")}>Get my code</button>
          </div>
        )}
      </section>
      {editing && b.me && (
        <section className="card fr-edit" aria-label="Your profile">
          <b className="small">Your picture</b>
          <div className="fr-avatars" role="radiogroup" aria-label="Your picture">{AVATARS.map((a) => <button key={a} role="radio" aria-checked={b.me!.avatar === a} className={`fr-av ${b.me!.avatar === a ? "on" : ""}`} onClick={() => saveProfile({ avatar: a })}>{a}</button>)}</div>
          <label className="field">Favourite game
            <select className="input" value={b.me.fav} onChange={(e) => saveProfile({ fav: e.target.value })}>
              <option value="">None picked</option>
              <optgroup label="Daily games">{b.games.map((g) => <option key={g.id} value={g.id}>{g.emoji} {g.title}</option>)}</optgroup>
              <optgroup label="Any time">{ANY_TIME.map((g) => <option key={g.id} value={g.id}>{g.emoji} {g.title}</option>)}</optgroup>
            </select>
          </label>
          <b className="small">Trophies to show off (up to {SHOWCASE_MAX})</b>
          {mine.length ? <div className="fr-show">{TROPHIES.filter((t) => mine.includes(t.id)).map((t) => { const on = b.me!.showcase.includes(t.id); return <button key={t.id} className={`chip ${on ? "on" : ""}`} aria-pressed={on} disabled={!on && b.me!.showcase.length >= SHOWCASE_MAX} onClick={() => saveProfile({ showcase: on ? b.me!.showcase.filter((x) => x !== t.id) : [...b.me!.showcase, t.id] })}>{t.emoji} {t.name}</button>; })}</div>
            : <p className="tiny muted">Win some trophies first, then pick your favourites here. <Link href="/trophies">See the shelf</Link></p>}
        </section>
      )}
      <div className="row" style={{ alignItems: "end", gap: "0.5rem", marginTop: "1rem", flexWrap: "wrap" }}>
        <label className="field" style={{ marginBottom: 0, maxWidth: "12rem" }}>Add a friend&apos;s code<input className="input" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC234" style={{ textTransform: "uppercase", letterSpacing: "0.12em" }} /></label>
        <button className="btn btn-ghost btn-sm" onClick={async () => { if (await post({ add: code }, "Friend added 🤝")) setCode(""); }} disabled={code.length < 6}>Add</button>
      </div>
      {!others.length ? <p className="small muted" style={{ marginTop: "1.2rem" }}>No friends added yet. Send them your code, or add theirs.</p> : (
        <>
          {!!b.feed?.length && (
            <>
              <h2 className="h3" style={{ marginTop: "1.4rem" }}>What friends have been playing</h2>
              <ul className="fr-feed">
                {b.feed.map((f, k) => <li key={k}><span className="fr-feed-av" aria-hidden="true">{f.avatar || "🙂"}</span><span><Link href={`/profile?code=${f.code}`}>{f.name}</Link> did <Link href={f.game.href}>{f.game.emoji} {f.game.title}</Link>: <b>{scoreText(f.game.id, f.ms)}</b></span><span className="tiny muted">{f.date === b.today ? "today" : f.date === prevDay(b.today) ? "yesterday" : "2 days ago"}</span></li>)}
              </ul>
            </>
          )}
          {b.league && (
            <>
              <h2 className="h3" style={{ marginTop: "1.4rem" }}>This week&apos;s league</h2>
              <ol className="fr-league">
                {b.league.map((s, k) => <li key={k} className={s.me ? "me" : ""}><span className="fr-rank">{k + 1}</span><span className="fr-who">{s.me ? "You" : s.name}{k === 0 && s.points > 0 ? " 👑" : ""}</span><b>{s.points} pts</b><span className="tiny muted">{s.solved} solved · {s.bests} best{s.bests === 1 ? "" : "s"}</span></li>)}
              </ol>
              <p className="tiny muted">A point for every daily puzzle you save this week, and two more for the best score among you on it. Starts fresh every Monday.</p>
            </>
          )}
          <h2 className="h3" style={{ marginTop: "1.4rem" }}>Today</h2>
          <div className="st-table-wrap">
            <table className="st-table fr-table">
              <thead><tr><th scope="col">Puzzle</th>{b.people.map((p) => <th key={key(p)} scope="col">{p.me ? "You" : p.name}</th>)}</tr></thead>
              <tbody>
                <tr><th scope="row">Played today</th>{b.people.map((p) => <td key={key(p)}><b>{p.played}</b></td>)}</tr>
                <tr><th scope="row">🗓 Puzzle of the week</th>{b.people.map((p) => <td key={key(p)}>{p.weekly !== null ? clock(p.weekly) : <span className="muted">—</span>}</td>)}</tr>
                {games.map((g) => (
                  <tr key={g.id}>
                    <th scope="row"><span aria-hidden="true">{g.emoji}</span> {g.title}</th>
                    {b.people.map((p) => { const t = p.times[g.id]; const many = b.people.filter((x) => x.times[g.id] !== undefined).length > 1; return <td key={key(p)} className={t !== undefined && many && t === best(g.id) ? "fr-best" : ""}>{t !== undefined ? scoreText(g.id, t) : <span className="muted">—</span>}</td>; })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny muted">🏅 marks the best of you on each puzzle. Times only show once they&apos;re saved to that puzzle&apos;s board. Your record against each friend (below) counts every daily puzzle you&apos;ve both saved in the last 90 days.</p>
          <h2 className="h3" style={{ marginTop: "1.2rem" }}>Your friends</h2>
          <ul className="games-more">{others.map((p) => <li key={p.code}><Link href={`/profile?code=${p.code}`}>{p.avatar} {p.name}</Link> <span className="tiny muted">· {p.code}{p.h2h && p.h2h.won + p.h2h.lost + p.h2h.drawn > 0 ? ` · you ${p.h2h.won}–${p.h2h.lost}${p.h2h.drawn ? ` (${p.h2h.drawn} drawn)` : ""}` : ""}</span> <button className="link-btn tiny" onClick={() => post({ remove: p.code }, `${p.name} removed`)}>Remove</button></li>)}</ul>
        </>
      )}
      <p className="small" style={{ marginTop: "1rem" }}><Link href="/puzzle-of-the-week">🗓 Race them on the puzzle of the week →</Link> · <Link href="/play-together">🎮 Play a friend live →</Link> · <Link href="/slow-games">🐢 Slow games: a move whenever you like →</Link></p>
    </div>
  );
}
