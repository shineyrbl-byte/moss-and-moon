"use client";
import { useEffect, useState } from "react";
import { rupees } from "@/lib/pricing";

type R = { item_id: string; item_name: string; qty: number; times: number; last: string; lost: number; waiting: number };

/** Owner: what guests wanted but couldn't get because it was sold out */
export default function MissedSales() {
  const [rows, setRows] = useState<R[] | null>(null);
  useEffect(() => { fetch("/api/admin/missed").then((r) => r.json()).then(setRows).catch(() => {}); }, []);
  if (!rows) return null;
  const total = rows.reduce((s, r) => s + r.lost, 0);
  return (
    <section className="card viz-card">
      <h3>😢 Missed sales</h3>
      <p className="small muted">Last 30 days: orders that failed because something had sold out, and guests who asked to hear when it&apos;s back.{rows.length ? ` About ${rupees(total)} of sales missed.` : ""}</p>
      {!rows.length ? <p className="small success">✓ Nothing missed. Nice stock planning!</p> : (
        <div className="rota-wrap">
          <table className="rota" style={{ minWidth: 0 }}>
            <thead><tr><th scope="col">Item</th><th scope="col">Wanted</th><th scope="col">Missed</th><th scope="col">Waiting for email</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.item_id}><th scope="row">{r.item_name}</th><td>{r.qty}</td><td>{rupees(r.lost)}</td><td>{r.waiting || "–"}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      <p className="tiny muted">Make or order more of the top ones. Guests waiting get an email by themselves when it&apos;s back.</p>
    </section>
  );
}
