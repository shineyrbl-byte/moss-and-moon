"use client";
import "./page.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { defaultOptions, rupees } from "@/lib/pricing";

type Stamp = { id: string; name: string; state: string; stamped: boolean; date: string | null; drink: string | null; tryThese: { id: string; name: string; price: number }[] };
type P = { stamps: Stamp[]; done: number; total: number; complete: boolean; claimed: string | null; reward: number };

export default function Passport() {
  const { menu, add, toast, setDrawerOpen } = useStore();
  const [p, setP] = useState<P | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const load = () => fetch("/api/account/passport").then(async (r) => { if (r.status === 401) return setSignedIn(false); setSignedIn(true); setP(await r.json()); }).catch(() => {});
  useEffect(() => { load(); }, []);
  async function claim() {
    const r = await fetch("/api/account/passport", { method: "POST" });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    toast(`🎉 ${rupees(p!.reward)} added to your account. Your next drink's on us!`);
    load();
  }
  const order = (id: string) => { const m = menu.find((x) => x.id === id); if (m) { add(m.id, defaultOptions(m), 1); toast(`${m.name} added ✿`); setDrawerOpen(true); } };

  if (signedIn === false)
    return (
      <div className="page narrow center">
        <span style={{ fontSize: "3rem" }}>🛂</span>
        <h1 className="h2">Origins <em>passport</em></h1>
        <p className="lead">Try a drink from each of the eight hills our coffee grows in and collect a stamp for each. Get all eight and your next drink is on us.</p>
        <Link href="/account" className="btn btn-pink">Sign in to start collecting</Link>
        <p className="small" style={{ marginTop: "1rem" }}><Link href="/origins">See the map first →</Link></p>
      </div>
    );
  if (!p) return <div className="page narrow"><p className="muted">Opening your passport…</p></div>;
  return (
    <div className="page" style={{ maxWidth: "60rem" }}>
      <p className="eyebrow">bean to cup</p>
      <h1 className="h2">Origins <em>passport</em></h1>
      <p className="lead">One stamp for every coffee region, earned when you order a drink made with its beans. Collect all {p.total} for a free drink.</p>
      <div className="sum-row" style={{ alignItems: "center", margin: "0.8rem 0" }}>
        <b>{p.done} of {p.total} stamps</b>
        <Link href="/origins" className="small">🗺 See them on the map</Link>
      </div>
      <div className="meter" aria-hidden style={{ maxWidth: "none" }}><span style={{ width: `${(p.done / p.total) * 100}%` }} /></div>
      {p.complete && (p.claimed
        ? <p className="reward-banner small" style={{ marginTop: "1rem" }}>🏅 Passport complete! You claimed your free drink on {p.claimed}.</p>
        : <div className="reward-banner" style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "0.8rem", flexWrap: "wrap" }}><span style={{ flex: 1 }}>🎉 <b>All {p.total} stamps!</b> Your free drink is waiting.</span><button className="btn btn-pink btn-sm" onClick={claim}>Claim {rupees(p.reward)} credit</button></div>)}
      <ul className="passport-grid">
        {p.stamps.map((s) => (
          <li key={s.id} className={`card stamp ${s.stamped ? "on" : ""}`}>
            <span className="stamp-ring" aria-hidden>{s.stamped ? "☕" : "?"}</span>
            <b>{s.name}</b>
            <span className="tiny muted">{s.state}</span>
            {s.stamped ? <span className="small">Stamped {s.date}<br /><span className="muted">with a {s.drink}</span></span> : (
              s.tryThese.length ? <span className="small">Try: {s.tryThese.slice(0, 2).map((d, i) => <span key={d.id}>{i ? " or " : ""}<button className="link-btn" onClick={() => order(d.id)}>{d.name}</button></span>)}<span className="muted"> ({rupees(s.tryThese[0].price)})</span></span> : <span className="small muted">Not on the menu right now</span>
            )}
          </li>
        ))}
      </ul>
      <p className="small muted">Stamps come from orders made while signed in. Coffees logged in your <Link href="/diary">diary</Link> from elsewhere don&apos;t count.</p>
    </div>
  );
}
