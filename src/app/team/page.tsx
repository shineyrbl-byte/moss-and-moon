"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import LabCard, { type LabCreation } from "@/components/LabCard";
import { photo } from "@/lib/menu";
import { defaultOptions, rupees } from "@/lib/pricing";

type Member = { id: number; name: string; role: string; bio: string; photo: string | null; emoji: string; fav: { id: string; name: string; price: number; img: string; soldOut: boolean } | null; creation: LabCreation | null };

export default function Team() {
  const { menu, add, toast, setDrawerOpen } = useStore();
  const [team, setTeam] = useState<Member[] | null>(null);
  const [thanking, setThanking] = useState<number | null>(null);
  const [note, setNote] = useState({ name: "", text: "" });
  const [busy, setBusy] = useState(false);
  async function thank(m: Member) {
    setBusy(true);
    const r = await fetch("/api/team/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staffId: m.id, ...note }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast(d.error ?? "That didn't send. Try again?");
    setThanking(null); setNote({ name: "", text: "" });
    toast(`💌 Sent! ${m.name} will see it on their next shift.`);
  }
  useEffect(() => { fetch("/api/team").then((r) => r.json()).then((d) => setTeam(d.team)).catch(() => setTeam([])); }, []);
  const order = (id: string) => { const m = menu.find((x) => x.id === id); if (m) { add(m.id, defaultOptions(m), 1); toast(`${m.name} added ✿`); setDrawerOpen(true); } };
  return (
    <div className="page" style={{ maxWidth: "62rem" }}>
      <p className="eyebrow">behind the counter</p>
      <h1 className="h2">Meet the <em>team</em></h1>
      <p className="lead">The people pouring your coffee, and the drinks they&apos;d order on their day off.</p>
      {team === null && <p className="muted">Calling everyone over…</p>}
      {team && !team.length && <p className="muted">The team is shy today. Check back soon ✿</p>}
      <div className="team-grid">
        {team?.map((m) => (
          <article key={m.id} className="card team-card">
            <div className="team-head">
              {m.photo ? <span className="team-photo"><Image src={m.photo} alt={m.name} fill sizes="88px" /></span> : <span className="team-photo emoji" aria-hidden>{m.emoji}</span>}
              <div><h2 className="h3" style={{ margin: 0 }}>{m.name}</h2><span className="small muted">{m.role}</span></div>
            </div>
            {m.bio && <p className="small">{m.bio}</p>}
            {m.fav && (
              <div className="team-fav">
                <span className="pick-ph" style={{ width: 56, height: 56, position: "relative", borderRadius: 12, overflow: "hidden", flex: "0 0 auto" }}><Image src={photo(m.fav.img, 160)} alt="" fill sizes="56px" /></span>
                <span style={{ flex: 1 }} className="small"><span className="muted">Always orders</span><br /><b>{m.fav.name}</b> <span className="muted">{rupees(m.fav.price)}</span></span>
                <button className="btn btn-ghost btn-sm" disabled={m.fav.soldOut} onClick={() => order(m.fav!.id)}>+ Add</button>
              </div>
            )}
            {m.creation && <><span className="small muted">Their drink lab creation</span><LabCard c={m.creation} /></>}
            {thanking !== m.id ? (
              <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => { setThanking(m.id); setNote({ name: note.name, text: "" }); }}>💌 Say thanks to {m.name}</button>
            ) : (
              <form className="thank-form" onSubmit={(e) => { e.preventDefault(); thank(m); }}>
                <label className="field small">A note for {m.name}<textarea className="input" rows={3} maxLength={300} required value={note.text} onChange={(e) => setNote({ ...note, text: e.target.value })} placeholder="That oat flat white made my morning!" /></label>
                <label className="field small">From <span className="muted">· optional</span><input className="input" maxLength={30} value={note.name} onChange={(e) => setNote({ ...note, name: e.target.value })} placeholder="Your first name" /></label>
                <span className="row" style={{ gap: "0.4rem" }}>
                  <button className="btn btn-pink btn-sm" disabled={busy || note.text.trim().length < 3}>{busy ? "Sending…" : "Send"}</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setThanking(null)}>Cancel</button>
                </span>
                <span className="tiny muted">Only {m.name} and the owner will read it.</span>
              </form>
            )}
          </article>
        ))}
      </div>
      <p className="small" style={{ marginTop: "1rem" }}><Link href="/lab">🧪 Make a creation of your own →</Link></p>
    </div>
  );
}
