"use client";
import { useCallback, useEffect, useState } from "react";
import { rupees } from "@/lib/pricing";
import { usePay } from "./Payment";
import { useStore } from "./Store";
import { useLive } from "./useLive";

type T = { table_no: number; orders: { code: string; name: string; due: number; left: number; items: string; at: string }[]; total: number; left: number };

/** Order page, at a table: every round on one tab, and "pay for the whole table" */
export default function TableTab({ code }: { code: string }) {
  const pay = usePay();
  const { toast } = useStore();
  const [t, setT] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => fetch(`/api/orders/${code}/tab`).then((r) => (r.ok ? r.json() : null)).then(setT).catch(() => {}), [code]);
  useEffect(() => { load(); }, [load]);
  useLive(`/api/live?topic=order&code=${encodeURIComponent(code)}`, () => load());
  if (!t || t.orders.length < 2) return null;
  async function payAll() {
    setBusy(true);
    const ok = await pay("tab", code);
    setBusy(false);
    if (ok) { toast("The table's paid. Thank you! ✿"); load(); }
  }
  return (
    <div className="card table-tab">
      <div className="sum-row" style={{ alignItems: "baseline" }}>
        <strong>🪑 Table {t.table_no}&apos;s tab · {t.orders.length} rounds</strong>
        <span>{t.left ? <><b>{rupees(t.left)}</b> <span className="muted small">left</span></> : <span className="success">all paid ✓</span>}</span>
      </div>
      <ul className="small">
        {t.orders.map((o) => <li key={o.code} className={o.code === code ? "me" : ""}><span className="muted">{o.at}</span> {o.items} <span className="muted">· {o.left ? rupees(o.due) : "paid"}</span></li>)}
      </ul>
      {t.left > 0 && <button className="btn btn-pink btn-sm" disabled={busy} onClick={payAll}>{busy ? "Opening…" : `Pay for the whole table · ${rupees(t.left)}`}</button>}
    </div>
  );
}
