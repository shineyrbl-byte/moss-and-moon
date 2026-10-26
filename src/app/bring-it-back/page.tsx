"use client";
import "./page.css";
import Image from "next/image";
import { useEffect, useState } from "react";
import { voterId } from "@/components/LabCard";
import { useStore } from "@/components/Store";
import { COMEBACK_MIN, monthLabel } from "@/lib/comeback";
import { photo } from "@/lib/menu";

type C = { id: string; name: string; img: string; cat: string; desc: string; votes: number };
type S = { month: string; next: string; candidates: C[]; mine: string | null; total: number; back: { id: string; name: string; img: string } | null };

export default function BringItBack() {
  const { toast } = useStore();
  const [s, setS] = useState<S | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch(`/api/comeback?voter=${voterId()}`).then((r) => r.json()).then(setS).catch(() => {}); }, []);
  async function vote(id: string) {
    setBusy(true);
    const r = await fetch("/api/comeback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: id, voter: voterId() }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return toast(d.error);
    setS(d);
    toast("🗳 Vote counted. You can change it until the month ends.");
  }
  if (!s) return <div className="page narrow"><p className="muted">Counting votes…</p></div>;
  const list = [...s.candidates].sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));
  const max = Math.max(1, ...list.map((c) => c.votes));
  return (
    <div className="page" style={{ maxWidth: "50rem" }}>
      <p className="eyebrow">vote for {monthLabel(s.month)}</p>
      <h1 className="h2">Bring it <em>back</em></h1>
      <p className="lead">Miss a drink or bake that&apos;s off the menu? Vote for it. The favourite this month comes back for all of {monthLabel(s.next)} (it needs at least {COMEBACK_MIN} votes).</p>
      {s.back && (
        <div className="card comeback-now">
          <div className="comeback-thumb"><Image src={photo(s.back.img, 200)} alt="" fill sizes="64px" style={{ objectFit: "cover" }} /></div>
          <span><b>Back now by your vote:</b> {s.back.name} 🎉<br /><a className="small" href="/#menu">Find it on the menu →</a></span>
        </div>
      )}
      {list.length < 2 ? <p className="muted">Nothing&apos;s off the menu right now, so there&apos;s nothing to vote on. Check back next month ✿</p> : (
        <>
          <p className="small muted">{s.total} vote{s.total === 1 ? "" : "s"} so far · {s.mine ? "tap another to change yours" : "one vote each"}</p>
          <ul className="comeback-list">
            {list.map((c) => (
              <li key={c.id} className={`card ${s.mine === c.id ? "mine" : ""}`}>
                <div className="comeback-thumb"><Image src={photo(c.img, 200)} alt="" fill sizes="64px" style={{ objectFit: "cover" }} /></div>
                <div className="comeback-info">
                  <b>{c.name}</b>
                  <span className="tiny muted comeback-desc">{c.desc}</span>
                  <span className="comeback-bar" aria-hidden="true"><span style={{ width: `${(c.votes / max) * 100}%` }} /></span>
                </div>
                <span className="comeback-act">
                  <span className="small"><b>{c.votes}</b></span>
                  <button className={`chip ${s.mine === c.id ? "on" : ""}`} disabled={busy} aria-pressed={s.mine === c.id} onClick={() => vote(c.id)}>{s.mine === c.id ? "✓ My vote" : "Vote"}</button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
