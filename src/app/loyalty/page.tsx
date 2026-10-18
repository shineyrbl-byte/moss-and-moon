"use client";
import { REWARDS } from "@/lib/pricing";
import Link from "next/link";
import { useEffect, useState } from "react";

type Card = { found: boolean; name: string | null; stamps: number; rewardsUsed: number; needed: number; hasReward: boolean };

export default function LoyaltyPage() {
  const [phone, setPhone] = useState("");
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState("");

  // Pre-fill the phone number used at checkout
  useEffect(() => {
    try {
      const me = JSON.parse(localStorage.getItem("mm-me") || "{}");
      if (me.phone) {
        setPhone(me.phone);
        lookup(me.phone);
      }
    } catch {}
  }, []);

  async function lookup(p = phone) {
    setError("");
    const r = await fetch(`/api/loyalty?phone=${encodeURIComponent(p)}`);
    const d = await r.json();
    if (!r.ok) return setError(d.error);
    setCard(d);
  }

  const filled = card ? Math.min(card.stamps, card.needed) : 0;

  return (
    <div className="page">
      <p className="eyebrow">the stamp card</p>
      <h1 style={{ fontSize: "clamp(2.4rem, 6vw, 4rem)" }}>Ten cups, <em>one on us</em></h1>
      <p className="lead">Every order earns a stamp. Collect {card?.needed ?? 10} and your next drink is free, or spend them in the rewards shop below.</p>

      <form className="row" style={{ marginTop: "2rem", maxWidth: "30rem" }} onSubmit={(e) => { e.preventDefault(); lookup(); }}>
        <input className="input" style={{ flex: 1 }} inputMode="numeric" placeholder="Your phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button className="btn btn-pink">Check</button>
      </form>
      {error && <p className="error" style={{ marginTop: "0.5rem" }}>{error}</p>}

      {card && (
        <div className="stamp-card card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <h3 style={{ fontSize: "2rem" }}>{card.found ? "Your card" : "A fresh card"}</h3>
              <p className="muted small">
                {card.found ? `${card.rewardsUsed} free drink${card.rewardsUsed === 1 ? "" : "s"} enjoyed so far` : "No stamps yet — your first order starts it!"}
              </p>
            </div>
            <span className="logo">M<span>&</span>M</span>
          </div>
          <div className="stamps">
            {Array.from({ length: card.needed }, (_, i) => (
              <div key={i} className={`stamp ${i < filled ? "on" : ""} ${i === card.needed - 1 ? "reward" : ""}`} style={{ animationDelay: `${i * 80}ms` }}>
                {i < filled ? "☕" : i === card.needed - 1 ? "🎁" : ""}
              </div>
            ))}
          </div>
          <p className="serif" style={{ fontSize: "1.4rem" }}>
            {card.hasReward ? "🎉 Your free drink is waiting — just place an order!" : `${card.needed - filled} more to go ✿`}
          </p>
          <p className="small muted">You have <b>{card.stamps}</b> stamp{card.stamps === 1 ? "" : "s"}.</p>
        </div>
      )}

      <div style={{ marginTop: "2rem" }}>
        <Link href="/#menu" className="btn btn-ghost">Go to the menu</Link>
      </div>
      <section className="card" style={{ padding: "1.4rem", marginTop: "1.5rem" }}>
        <h2 className="h3" style={{ marginTop: 0 }}>🎁 Rewards shop</h2>
        <p className="small muted">Pick a reward at checkout (with that thing in your tray) and we&apos;ll take it off.</p>
        <ul className="check-list">
          {REWARDS.map((r) => (
            <li key={r.id}>
              <span style={{ flex: 1 }}><b>{r.label}</b></span>
              <span className={card && card.stamps >= r.stamps ? "success" : "muted"}>{r.stamps} ★{card && card.stamps >= r.stamps ? " · yours!" : ""}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
