"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { rupees } from "@/lib/pricing";
import AddToCalendar from "@/components/AddToCalendar";

type C = { code: string; cake: string; size: string; message: string | null; date: string; time: string; name: string; price: number; status: string };

export default function CakeStatus() {
  const { code } = useParams<{ code: string }>();
  const [c, setC] = useState<C | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { fetch(`/api/cakes/${code}`).then(async (r) => { const d = await r.json(); if (!r.ok) return setError(d.error); setC(d); }).catch(() => setError("Couldn't load it.")); }, [code]);
  if (error) return <div className="page center"><h2>Hmm, <em>not found</em></h2><p className="lead">{error}</p><Link className="btn" href="/cakes">Order a cake</Link></div>;
  if (!c) return <div className="page center"><p className="muted">Loading…</p></div>;
  const when = new Date(`${c.date}T12:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const label: Record<string, string> = { unpaid: "Not paid yet", paid: "Booked: we'll bake it fresh", ready: "Ready to collect! 🎂", collected: "Collected. Enjoy!", cancelled: "Cancelled" };
  return (
    <div className="page narrow center">
      <span style={{ fontSize: "3.5rem" }}>🎂</span>
      <h1 className="h2">{c.cake}, <em>{c.size}</em></h1>
      <p className="lead">{label[c.status] ?? c.status}</p>
      <div className="card" style={{ padding: "1.3rem", textAlign: "left" }}>
        <p>Pickup: <b>{when}, {c.time}</b></p>
        {c.message && <p>On top: <b>“{c.message}”</b></p>}
        <p>{c.status === "unpaid" ? "To pay" : "Paid"}: <b>{rupees(c.price)}</b></p>
        <p className="small muted">Show code <b style={{ fontFamily: "monospace" }}>{c.code}</b> at the counter.</p>
      </div>
      {(c.status === "paid" || c.status === "unpaid" || c.status === "ready") && <p style={{ marginTop: "1rem" }}><AddToCalendar event={{ uid: c.code, title: `Pick up cake: ${c.cake}`, date: c.date, time: c.time, minutes: 15, details: `Cake order ${c.code}. Show this code at the counter.`, alarmMinutes: 120 }} /></p>}
    </div>
  );
}
