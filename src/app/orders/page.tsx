"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getHistory } from "@/lib/history";
import { rupees, type QuoteLine } from "@/lib/pricing";
import { findItem } from "@/lib/menu";
import { useStore } from "@/components/Store";

type Order = { code: string; status: string; total: number; giftcard_used: number; pay_status: string; lines: QuoteLine[]; created_at: string };

export default function MyOrders() {
  const { add, setDrawerOpen, toast, soldOut } = useStore();
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    const list = getHistory();
    Promise.all(list.map((o) => fetch(`/api/orders/${o.code}`).then((r) => (r.ok ? r.json() : null)).catch(() => null))).then((rs) =>
      setOrders(rs.filter(Boolean) as Order[])
    );
  }, []);

  function orderAgain(o: Order) {
    let added = 0;
    for (const l of o.lines) {
      if (!findItem(l.itemId) || soldOut.has(l.itemId)) continue;
      add(l.itemId, l.opts, l.qty);
      added++;
    }
    if (!added) return toast("Those items aren't available right now 🥲");
    toast(added < o.lines.length ? "Added what's available today ✿" : "Added to your tray ✿");
    setDrawerOpen(true);
  }

  return (
    <div className="page">
      <p className="eyebrow">from this device</p>
      <h1 style={{ fontSize: "clamp(2.4rem, 6vw, 4rem)" }}>My <em>orders</em></h1>
      <p className="lead">Your usual, one tap away. Orders you place on this browser show up here.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "2rem" }}>
        {orders === null && <p className="muted">Loading…</p>}
        {orders?.length === 0 && (
          <div className="card empty-state">
            <p>No orders yet — your first one is waiting ☕</p>
            <Link href="/#menu" className="btn btn-sm" style={{ marginTop: "1rem" }}>See the menu</Link>
          </div>
        )}
        {orders?.map((o) => (
          <div key={o.code} className="card history-card">
            <div>
              <div className="row" style={{ alignItems: "center", gap: "0.6rem" }}>
                <strong>{o.code}</strong>
                <span className={`status-tag ${o.status}`}>{o.status}</span>
                {o.pay_status === "paid" && <span className="status-tag paid">paid</span>}
              </div>
              <p className="small muted">{new Date(o.created_at.replace(" ", "T")).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p>
              <p className="small" style={{ marginTop: "0.3rem" }}>{o.lines.map((l) => `${l.qty} × ${l.name}`).join(", ")}</p>
            </div>
            <div className="history-actions">
              <strong>{rupees(o.total - o.giftcard_used)}</strong>
              <div className="row">
                <Link href={`/order/${o.code}`} className="btn btn-ghost btn-sm">View</Link>
                <button className="btn btn-pink btn-sm" onClick={() => orderAgain(o)}>Order again</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
