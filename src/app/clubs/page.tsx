"use client";
import "./page.css";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { addFlag } from "@/lib/trophyFlags";

type V = { week: string; mine: { code: string; name: string; members: { name: string; me: boolean; solved: number }[]; total: number; rank: number | null } | null; board: { name: string; members: number; total: number; perMember: number; mine: boolean }[] };

export default function Clubs() {
  const { toast } = useStore();
  const [v, setV] = useState<V | null>(null);
  const [name, setName] = useState(""), [club, setClub] = useState(""), [code, setCode] = useState("");
  useEffect(() => {
    try { setName(localStorage.getItem("mm-game-name") ?? ""); } catch {}
    const q = new URLSearchParams(location.search).get("join"); if (q) setCode(q.toUpperCase());
    fetch(`/api/clubs?voter=${voterId()}`).then((r) => r.json()).then(setV).catch(() => {});
  }, []);
  useEffect(() => { if (v?.mine?.rank === 1) addFlag("club-top"); }, [v?.mine?.rank]);
  async function post(body: Record<string, unknown>, ok: string) {
    try { if (name) localStorage.setItem("mm-game-name", name); } catch {}
    const r = await fetch("/api/clubs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voter: voterId(), name, ...body }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setV(d); toast(ok);
  }
  async function invite() {
    if (!v?.mine) return;
    const url = `${location.origin}/clubs?join=${v.mine.code}`;
    try { if (navigator.share) await navigator.share({ text: `Join my café club "${v.mine.name}" on Moss & Moon`, url }); else { await navigator.clipboard.writeText(url); toast("Invite link copied 📋"); } } catch {}
  }
  if (!v) return <div className="page"><p className="muted">Pulling up a chair…</p></div>;
  const monday = new Date(`${v.week}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">play with people</p>
      <h1 className="h2">Café <em>clubs</em></h1>
      <p className="small muted">Start a club with friends, family or the office, or join one with its code. Every daily puzzle a member saves counts for the club this week. Clubs are ranked by puzzles per member, so a small club can beat a big one.</p>
      {v.mine ? (
        <section className="card cb-mine">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.4rem" }}>
            <h2 className="h3" style={{ margin: 0 }}>{v.mine.name}</h2>
            <span className="small muted">code <b className="cb-code">{v.mine.code}</b>{v.mine.rank ? ` · ${v.mine.rank}${["th", "st", "nd", "rd"][v.mine.rank % 10 > 3 || [11, 12, 13].includes(v.mine.rank % 100) ? 0 : v.mine.rank % 10]} this week` : ""}</span>
          </div>
          <p className="small">{v.mine.total} puzzle{v.mine.total === 1 ? "" : "s"} solved since Monday {monday}.</p>
          <ol className="cb-members">{v.mine.members.map((m, k) => <li key={k} className={m.me ? "me" : ""}><span>{m.me ? `${m.name} (you)` : m.name}</span><b>{m.solved}</b></li>)}</ol>
          <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            <button className="btn btn-pink btn-sm" onClick={invite}>📤 Invite people</button>
            <button className="btn btn-ghost btn-sm" onClick={() => post({ leave: true }, "You've left the club")}>Leave</button>
          </div>
        </section>
      ) : (
        <div className="cb-forms">
          <label className="field">Your name in the club<input className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest" /></label>
          <form className="card cb-form" onSubmit={(e) => { e.preventDefault(); void post({ join: code }, "Welcome to the club ☕"); }}>
            <label className="field" style={{ margin: 0 }}>Join with a code<input className="input" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC234" style={{ letterSpacing: "0.12em" }} /></label>
            <button className="btn btn-pink btn-sm" disabled={code.length < 6}>Join</button>
          </form>
          <form className="card cb-form" onSubmit={(e) => { e.preventDefault(); void post({ create: club }, "Your club's started 🎉 Invite some people"); }}>
            <label className="field" style={{ margin: 0 }}>Or start a club<input className="input" maxLength={30} value={club} onChange={(e) => setClub(e.target.value)} placeholder="The Saturday regulars" /></label>
            <button className="btn btn-ghost btn-sm" disabled={club.trim().length < 2}>Start it</button>
          </form>
        </div>
      )}
      <h2 className="h3" style={{ marginTop: "1.4rem" }}>This week&apos;s clubs</h2>
      {v.board.length ? (
        <table className="cb-board"><thead><tr><th scope="col">#</th><th scope="col">Club</th><th scope="col">Members</th><th scope="col">Per member</th></tr></thead>
          <tbody>{v.board.map((c, k) => <tr key={k} className={c.mine ? "mine" : ""}><td>{k + 1}</td><td>{c.name}</td><td>{c.members}</td><td><b>{c.perMember}</b></td></tr>)}</tbody></table>
      ) : <p className="small muted">No clubs yet. Start the first one.</p>}
    </div>
  );
}
