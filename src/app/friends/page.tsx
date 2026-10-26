"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { clock } from "@/lib/memory";
import { scoreText } from "@/lib/scoreText";

type Person = { code: string; name: string; me: boolean; played: number; times: Record<string, number>; weekly: number | null };
type Board = { me: { code: string; name: string } | null; people: Person[]; games: { id: string; title: string; emoji: string }[]; today: string; week: string };

export default function Friends() {
  const { toast } = useStore();
  const [b, setB] = useState<Board | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  useEffect(() => {
    try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    // A link like /friends?add=CODE fills the box in
    const c = new URLSearchParams(location.search).get("add");
    if (c) setCode(c.toUpperCase().slice(0, 6));
    fetch(`/api/friends?voter=${voterId()}`).then((r) => r.json()).then(setB).catch(() => {});
  }, []);
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
      <p className="small muted">Swap friend codes and see how you each did on today&apos;s puzzles and the puzzle of the week. Friends only see the name you pick and your saved times, nothing else.</p>
      <section className="card fr-me">
        {b.me ? (
          <>
            <span className="small">Your friend code</span>
            <b className="fr-code">{b.me.code}</b>
            <span className="small muted">Friends see you as <b>{b.me.name}</b></span>
            <button className="btn btn-pink btn-sm" onClick={share}>📤 Send my code</button>
          </>
        ) : (
          <div className="row" style={{ alignItems: "end", gap: "0.5rem", flexWrap: "wrap" }}>
            <label className="field" style={{ marginBottom: 0, maxWidth: "14rem" }}>Your name for friends<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Asha" /></label>
            <button className="btn btn-pink btn-sm" onClick={() => post({ name }, "Here's your friend code 🎉")}>Get my code</button>
          </div>
        )}
      </section>
      <div className="row" style={{ alignItems: "end", gap: "0.5rem", marginTop: "1rem", flexWrap: "wrap" }}>
        <label className="field" style={{ marginBottom: 0, maxWidth: "12rem" }}>Add a friend&apos;s code<input className="input" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC234" style={{ textTransform: "uppercase", letterSpacing: "0.12em" }} /></label>
        <button className="btn btn-ghost btn-sm" onClick={async () => { if (await post({ add: code }, "Friend added 🤝")) setCode(""); }} disabled={code.length < 6}>Add</button>
      </div>
      {!others.length ? <p className="small muted" style={{ marginTop: "1.2rem" }}>No friends added yet. Send them your code, or add theirs.</p> : (
        <>
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
          <p className="tiny muted">🏅 marks the best of you on each puzzle. Times only show once they&apos;re saved to that puzzle&apos;s board.</p>
          <h2 className="h3" style={{ marginTop: "1.2rem" }}>Your friends</h2>
          <ul className="games-more">{others.map((p) => <li key={p.code}>{p.name} <span className="tiny muted">· {p.code}</span> <button className="link-btn tiny" onClick={() => post({ remove: p.code }, `${p.name} removed`)}>Remove</button></li>)}</ul>
        </>
      )}
      <p className="small" style={{ marginTop: "1rem" }}><Link href="/puzzle-of-the-week">🗓 Race them on the puzzle of the week →</Link> · <Link href="/play-together">🎮 Play a friend live →</Link></p>
    </div>
  );
}
