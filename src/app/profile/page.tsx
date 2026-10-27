"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";

type G = { id: string; title: string; emoji: string; href: string };
type P = {
  code: string; name: string; me: boolean; isFriend: boolean; avatar: string; fav: G | null;
  showcase: { id: string; emoji: string; name: string; how: string }[]; days: number; puzzles: number; first: string | null;
  h2h: { won: number; lost: number; drawn: number; games: (G & { won: number; lost: number; drawn: number })[] } | null;
};

export default function Profile() {
  const { toast } = useStore();
  const [p, setP] = useState<P | null | "missing">(null);
  const [code, setCode] = useState("");
  useEffect(() => {
    const c = new URLSearchParams(location.search).get("code") ?? "";
    setCode(c);
    fetch(`/api/friends?profile=${encodeURIComponent(c)}&voter=${voterId()}`).then(async (r) => setP(r.ok ? await r.json() : "missing")).catch(() => setP("missing"));
  }, []);
  async function add() {
    const r = await fetch("/api/friends", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voter: voterId(), add: code }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    toast("Friend added 🤝"); setP({ ...(p as P), isFriend: true });
  }
  if (p === null) return <div className="page"><p className="muted">Finding them…</p></div>;
  if (p === "missing") return <div className="page"><h1 className="h2">No one by that code</h1><p className="muted">Check the friend code and try again. <Link href="/friends">Back to the friends board</Link></p></div>;
  const total = p.h2h ? p.h2h.won + p.h2h.lost + p.h2h.drawn : 0;
  const since = p.first ? new Date(`${p.first}T12:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : null;
  return (
    <div className="page" style={{ maxWidth: "34rem" }}>
      <p className="eyebrow">{p.me ? "your profile" : "game profile"}</p>
      <div className="row" style={{ gap: "0.8rem", alignItems: "center" }}>
        <span style={{ fontSize: "3rem", lineHeight: 1 }} aria-hidden="true">{p.avatar || "🙂"}</span>
        <div><h1 className="h2" style={{ margin: 0 }}>{p.name}</h1><span className="tiny muted">Friend code {p.code}</span></div>
      </div>
      <p className="memory-stats" style={{ display: "flex", justifyContent: "center", flexWrap: "wrap" }}><span><b>{p.puzzles}</b> puzzles saved</span><span><b>{p.days}</b> days played</span>{since && <span>Since {since}</span>}</p>
      {p.fav && <p>Favourite game: <Link href={p.fav.href}>{p.fav.emoji} {p.fav.title}</Link></p>}
      <h2 className="h3" style={{ marginTop: "1.2rem" }}>Trophy showcase</h2>
      {p.showcase.length ? <ul className="games-more">{p.showcase.map((t) => <li key={t.id}><span aria-hidden="true">{t.emoji}</span> <b>{t.name}</b> <span className="tiny muted">· {t.how}</span></li>)}</ul>
        : <p className="small muted">{p.me ? <>Nothing picked yet. Choose up to three on the <Link href="/friends">friends board</Link> (✏️ My profile).</> : "Nothing picked yet."}</p>}
      {p.h2h && (
        <>
          <h2 className="h3" style={{ marginTop: "1.2rem" }}>You against {p.name}</h2>
          {total ? (
            <>
              <p className="memory-stats" style={{ display: "flex", justifyContent: "center" }}><span>Won <b>{p.h2h.won}</b></span><span>Lost <b>{p.h2h.lost}</b></span><span>Drawn <b>{p.h2h.drawn}</b></span></p>
              <div className="st-table-wrap"><table className="st-table">
                <thead><tr><th scope="col">Puzzle</th><th scope="col">Won</th><th scope="col">Lost</th><th scope="col">Drawn</th></tr></thead>
                <tbody>{p.h2h.games.map((g) => <tr key={g.id}><th scope="row"><Link href={g.href}>{g.emoji} {g.title}</Link></th><td>{g.won}</td><td>{g.lost}</td><td>{g.drawn}</td></tr>)}</tbody>
              </table></div>
              <p className="tiny muted">Every daily puzzle you&apos;ve both saved in the last 90 days. The better score wins.</p>
            </>
          ) : <p className="small muted">You haven&apos;t both saved the same daily puzzle yet. Pick one and race them!</p>}
        </>
      )}
      <p className="small" style={{ marginTop: "1rem" }}>
        {!p.me && !p.isFriend && <><button className="btn btn-pink btn-sm" onClick={add}>🤝 Add {p.name} as a friend</button>{" "}</>}
        <Link href="/friends">Friends board →</Link> · <Link href="/slow-games">🐢 Start a slow game →</Link>
      </p>
    </div>
  );
}
