"use client";
import "./page.css";
import { useEffect, useState } from "react";
import { OWN_CUP_OFF } from "@/lib/pricing";
import { monthLabel } from "@/lib/comeback";

type C = { month: string; thisMonth: number; total: number; goal: number };

export default function CupsSaved() {
  const [c, setC] = useState<C | null>(null);
  useEffect(() => { fetch("/api/cups").then((r) => r.json()).then(setC).catch(() => {}); }, []);
  if (!c) return <div className="page narrow"><p className="muted">Counting cups…</p></div>;
  const pct = Math.min(100, Math.round((c.thisMonth / c.goal) * 100));
  return (
    <div className="page" style={{ maxWidth: "38rem" }}>
      <p className="eyebrow">♻️ bring your own cup</p>
      <h1 className="h2">Cups <em>saved</em></h1>
      <p className="lead">Every time someone brings their own cup, that&apos;s one less paper cup in a bin (or the sea). Here&apos;s how we&apos;re doing together.</p>
      <section className="card cups-card">
        <p className="cups-big"><b>{c.thisMonth.toLocaleString("en-IN")}</b> <span>cups saved in {monthLabel(c.month)}</span></p>
        <div className="cups-bar" role="progressbar" aria-valuemin={0} aria-valuemax={c.goal} aria-valuenow={c.thisMonth} aria-label="Progress to this month's goal"><span style={{ width: `${pct}%` }} /></div>
        <p className="small" style={{ margin: 0 }}>{c.thisMonth >= c.goal ? `🎉 We hit this month's goal of ${c.goal}!` : `${c.goal - c.thisMonth} to go to this month's goal of ${c.goal}`}</p>
        <p className="small muted" style={{ margin: 0 }}>{c.total.toLocaleString("en-IN")} saved since we started counting</p>
      </section>
      <h2 className="h3" style={{ marginTop: "1.4rem" }}>How it works</h2>
      <ul className="cups-how">
        <li>☕ Bring any clean cup or flask for a takeaway drink.</li>
        <li>🛍 Ordering ahead? Tick <b>&ldquo;I&apos;ll bring my own cup&rdquo;</b> in your tray.</li>
        <li>💸 It&apos;s ₹{OWN_CUP_OFF} off every drink, and it counts here.</li>
      </ul>
    </div>
  );
}
