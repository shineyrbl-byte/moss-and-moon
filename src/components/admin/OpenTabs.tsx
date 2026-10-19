"use client";
import { useCallback, useEffect, useState } from "react";
import { rupees } from "@/lib/pricing";
import { useStore } from "../Store";

type T = { id: number; table_no: number; opened_at: string; orders: { code: string; left: number }[]; total: number; left: number };

/** Orders tab: tables with an open tab, and "paid at the counter" */
export default function OpenTabs() {
  const { toast } = useStore();
  const [list, setList] = useState<T[]>([]);
  const load = useCallback(() => fetch("/api/admin/tabs").then((r) => (r.ok ? r.json() : [])).then(setList).catch(() => {}), []);
  useEffect(() => { load(); const i = setInterval(load, 30_000); return () => clearInterval(i); }, [load]);
  if (!list.length) return null;
  async function paid(t: T) {
    const r = await fetch("/api/admin/tabs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tabId: t.id }) });
    if (!r.ok) return toast((await r.json()).error);
    setList((await r.json()).tabs);
    toast(`Table ${t.table_no} paid ✓`);
  }
  return (
    <section className="card" style={{ padding: "0.9rem 1.1rem", marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "1.1rem" }}>🪑 Open table tabs</h3>
      <ul className="check-list">
        {list.map((t) => (
          <li key={t.id}>
            <span style={{ flex: 1 }}><b>Table {t.table_no}</b> <span className="muted small">· {t.orders.length} round{t.orders.length === 1 ? "" : "s"} since {t.opened_at.slice(11, 16)} · {rupees(t.total)}</span></span>
            {t.left > 0 ? <><b>{rupees(t.left)} to pay</b><button className="btn btn-ghost btn-sm" onClick={() => paid(t)}>Paid at counter</button></> : <span className="success small">paid ✓</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
