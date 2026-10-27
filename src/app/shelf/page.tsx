"use client";
import "./page.css";
import Link from "next/link";
import { useEffect, useState } from "react";

type Item = { id: string; kind: "game" | "book"; title: string; detail: string; minutes: number | null; note: string | null; out: number };

export default function Shelf() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [q, setQ] = useState("");
  const [players, setPlayers] = useState(0);
  const [popular, setPopular] = useState<{ id: string; title: string; plays: number }[]>([]);
  useEffect(() => {
    fetch("/api/shelf").then((r) => r.json()).then((d) => setItems(d.items)).catch(() => setItems([]));
    fetch("/api/game-plays").then((r) => r.json()).then((d) => setPopular(d.top ?? [])).catch(() => {});
  }, []);
  // "3–4 players" → does it suit this many?
  const fits = (detail: string, n: number) => {
    if (!n) return true;
    const m = /(\d+)(?:\s*[–-]\s*(\d+)|(\+))?/.exec(detail);
    if (!m) return true;
    const lo = Number(m[1]), hi = m[3] ? 99 : Number(m[2] ?? m[1]);
    return n >= lo && n <= hi;
  };
  const match = (i: Item) => !q || `${i.title} ${i.detail}`.toLowerCase().includes(q.toLowerCase());
  const games = (items ?? []).filter((i) => i.kind === "game" && match(i) && fits(i.detail, players));
  const books = (items ?? []).filter((i) => i.kind === "book" && match(i));

  return (
    <div className="page" style={{ maxWidth: "62rem" }}>
      <p className="eyebrow">stay a while</p>
      <h1 className="h2">Games <em>&amp;</em> books</h1>
      <p className="lead">Borrow anything from the shelf while you&apos;re here. Want a game kept for you? Pick it when you <Link href="/#visit" className="link-btn">book a table</Link>.</p>
      <p className="small"><Link href="/book-club">📚 This month&apos;s book club pick →</Link> · <Link href="/scoreboard">🏆 Scoreboard →</Link> · <Link href="/game-night">🎲 Board-game night →</Link></p>
      {popular.length > 0 && <p className="small muted">Most played this month: {popular.slice(0, 3).map((g, i) => <span key={g.id}>{i ? ", " : ""}<Link href={`/scoreboard?game=${g.id}`}>{g.title}</Link> ({g.plays})</span>)}</p>}
      <div className="row" style={{ gap: "0.8rem", alignItems: "flex-end", flexWrap: "wrap", margin: "1rem 0" }}>
        <label className="field small" style={{ maxWidth: 260 }}>Search<input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Catan, Ruskin Bond…" /></label>
        <div className="chips" role="radiogroup" aria-label="How many of you?" style={{ justifyContent: "flex-start" }}>
          {[0, 2, 3, 4, 6].map((n) => <button key={n} role="radio" aria-checked={players === n} className={`chip ${players === n ? "on" : ""}`} onClick={() => setPlayers(n)}>{n ? `${n}${n === 6 ? "+" : ""} of us` : "Any size"}</button>)}
        </div>
      </div>
      {!items && <p className="muted">Looking at the shelf…</p>}

      <h2 className="h3">🎲 Board games <span className="muted small">· {games.length}</span></h2>
      <ul className="shelf-grid">
        {games.map((g) => (
          <li key={g.id} className={`card ${g.out ? "is-out" : ""}`}>
            <b>{g.title}</b>
            <span className="small muted">{g.detail}{g.minutes ? ` · about ${g.minutes} min` : ""}</span>
            {g.note && <span className="small">{g.note}</span>}
            {g.out ? <span className="branch-tag">off the shelf for now</span> : <Link href={`/?game=${g.id}#visit`} className="link-btn small">Reserve with a table →</Link>}
            <Link href={`/scoreboard?game=${g.id}`} className="tiny muted">🏆 Log a win</Link>
          </li>
        ))}
      </ul>
      {items && !games.length && <p className="small muted">Nothing for that many. Try another size?</p>}

      <h2 className="h3" style={{ marginTop: "1.5rem" }}>📚 Books <span className="muted small">· {books.length}</span></h2>
      <ul className="shelf-grid">
        {books.map((b) => (
          <li key={b.id} className={`card ${b.out ? "is-out" : ""}`}>
            <b>{b.title}</b>
            <span className="small muted">{b.detail}</span>
            {b.out ? <span className="branch-tag">borrowed right now</span> : <span className="small muted">On the shelf by the window</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
