"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { rupees } from "@/lib/pricing";
import { useStore } from "@/components/Store";

type L = { code: string; name: string; pickup_date: string; pickup_time: string; summary: string; estimate: number; status: string; order_code: string | null };

export default function LaterOrder() {
  const { code } = useParams<{ code: string }>();
  const { toast } = useStore();
  const [o, setO] = useState<L | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => fetch(`/api/orders/later/${code}`).then(async (r) => { const d = await r.json(); if (!r.ok) return setError(d.error); setO(d); }).catch(() => setError("Couldn't load it.")), [code]);
  useEffect(() => { load(); }, [load]);
  if (error) return <div className="page center"><h2>Hmm, <em>not found</em></h2><p className="lead">{error}</p><Link className="btn" href="/#menu">Menu</Link></div>;
  if (!o) return <div className="page center"><p className="muted">Loading…</p></div>;
  const when = new Date(`${o.pickup_date}T12:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  async function cancel() {
    const r = await fetch(`/api/orders/later/${code}`, { method: "DELETE" });
    if (!r.ok) return toast((await r.json()).error);
    toast("Cancelled");
    load();
  }
  return (
    <div className="page narrow center">
      <span style={{ fontSize: "3.5rem" }}>🌅</span>
      <h1 className="h2">{o.status === "cancelled" ? "Cancelled" : <>See you {when === new Date(Date.now() + 86_400_000).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) ? "tomorrow" : when}, <em>{o.name}</em></>}</h1>
      <div className="card" style={{ padding: "1.3rem", textAlign: "left" }}>
        <p>Pickup: <b>{when}, {o.pickup_time}</b></p>
        <p>{o.summary}</p>
        <p className="small muted">About {rupees(o.estimate)}, paid at the counter. We start making it 15 minutes before.</p>
        {o.status === "saved" && <button className="btn btn-ghost btn-sm" onClick={cancel}>Cancel this order</button>}
        {o.status === "placed" && o.order_code && <Link className="btn btn-pink btn-sm" href={`/order/${o.order_code}`}>Track it now</Link>}
        {(o.status === "failed" || o.status === "missed") && <p className="cashup-bad small">This one didn&apos;t go through. Please order again or pop in.</p>}
      </div>
    </div>
  );
}
