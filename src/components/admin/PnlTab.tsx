"use client";
import { useCallback, useEffect, useState } from "react";
import { rupees } from "@/lib/pricing";
import { useStore } from "../Store";

type Expense = { id: number; month: string; category: string; label: string; amount: number; recurring: number };
type P = {
  month: string; orders: number; sales: number; tickets: number; catering: number; cakes?: number; revenue: number; cogs: number; waste: number; gross: number;
  expenses: number; byCategory: Record<string, number>; expenseList: Expense[]; net: number; margin: number;
  trend: { month: string; revenue: number; net: number }[]; categories: string[];
};
const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const label = (m: string, long = false) => new Date(m + "-01T12:00").toLocaleDateString("en-IN", long ? { month: "long", year: "numeric" } : { month: "short" });
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const money = (n: number) => (n < 0 ? `−${rupees(-n)}` : rupees(n));

/** Owner: the month's profit & loss, with rent, wages and other costs */
export default function PnlTab() {
  const { toast } = useStore();
  const [month, setMonth] = useState("");
  const [p, setP] = useState<P | null>(null);
  const [add, setAdd] = useState({ category: "rent", label: "", amount: "", recurring: true });
  const [table, setTable] = useState(false);
  const load = useCallback(() => fetch(`/api/admin/pnl${month ? `?month=${month}` : ""}`).then((r) => r.json()).then(setP).catch(() => {}), [month]);
  useEffect(() => { load(); }, [load]);
  if (!p) return <p className="muted">Loading…</p>;

  async function addExpense() {
    const r = await fetch("/api/admin/pnl", json("POST", { ...add, month: p!.month }));
    const x = await r.json();
    if (!r.ok) return toast(x.error);
    setAdd((a) => ({ ...a, label: "", amount: "" }));
    load();
  }
  async function remove(e: Expense) {
    await fetch("/api/admin/pnl", json("DELETE", { id: e.id }));
    toast(e.recurring ? "Removed from every month" : "Removed");
    load();
  }
  const max = Math.max(1, ...p.trend.map((t) => Math.abs(t.net)));
  const row = (name: string, v: number, strong = false, minus = false) => (
    <tr className={strong ? "pnl-total" : ""}><th scope="row">{name}</th><td>{minus && v ? `−${rupees(v)}` : money(v)}</td></tr>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
      <section className="card" style={{ padding: "1.1rem 1.2rem" }}>
        <div className="sum-row" style={{ alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <h3 style={{ fontSize: "1.3rem" }}>📒 Profit &amp; loss · {label(p.month, true)}</h3>
          <select className="input" style={{ width: "auto" }} value={p.month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
            {p.trend.map((t) => <option key={t.month} value={t.month}>{label(t.month, true)}</option>)}
          </select>
        </div>
        <div className="pnl-hero">
          <div><span className="small muted">Net profit</span><b className={p.net < 0 ? "neg" : ""}>{money(p.net)}</b></div>
          <div><span className="small muted">Margin</span><b>{p.margin}%</b></div>
          <div><span className="small muted">Orders</span><b>{p.orders}</b></div>
        </div>
        <table className="rota pnl-table" style={{ minWidth: 0 }}>
          <tbody>
            {row("Café sales (after discounts & refunds)", p.sales)}
            {p.tickets > 0 && row("Event tickets", p.tickets)}
            {p.catering > 0 && row("Catering", p.catering)}
            {!!p.cakes && row("Whole cakes", p.cakes)}
            {row("Revenue", p.revenue, true)}
            {row("Cost of what was sold", p.cogs, false, true)}
            {row("Thrown away", p.waste, false, true)}
            {row("Gross profit", p.gross, true)}
            {Object.entries(p.byCategory).map(([c, v]) => <tr key={c}><th scope="row">{cap(c)}</th><td>−{rupees(Math.round(v))}</td></tr>)}
            {row("Net profit", p.net, true)}
          </tbody>
        </table>
        <p className="tiny muted">Ingredient costs come from Stock; bakes without a cost are guessed at 35% of their price. Tips go to the team and aren&apos;t counted.</p>
      </section>

      <section className="card" style={{ padding: "1.1rem 1.2rem" }}>
        <h3 style={{ fontSize: "1.1rem" }}>Expenses for {label(p.month, true)}</h3>
        {p.expenseList.length ? (
          <ul className="backup-list">
            {p.expenseList.map((e) => (
              <li key={e.id}><span>{e.label} <span className="muted small">· {e.category}{e.recurring ? " · every month" : ""}</span></span><span>{rupees(Math.round(e.amount))}</span><button className="link-btn" onClick={() => remove(e)}>Remove</button></li>
            ))}
          </ul>
        ) : <p className="small muted">No expenses yet. Add rent, wages and bills to see your true profit.</p>}
        <div className="pnl-add">
          <select className="input" value={add.category} onChange={(e) => setAdd((a) => ({ ...a, category: e.target.value }))} aria-label="Category">
            {p.categories.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
          </select>
          <input className="input" placeholder="What for (optional)" value={add.label} maxLength={80} onChange={(e) => setAdd((a) => ({ ...a, label: e.target.value }))} aria-label="What for" />
          <input className="input" placeholder="₹ amount" inputMode="decimal" value={add.amount} onChange={(e) => setAdd((a) => ({ ...a, amount: e.target.value.replace(/[^\d.]/g, "") }))} aria-label="Amount" />
          <label className="row small" style={{ alignItems: "center", gap: "0.35rem" }}><input type="checkbox" checked={add.recurring} onChange={(e) => setAdd((a) => ({ ...a, recurring: e.target.checked }))} /> Every month</label>
          <button className="btn btn-pink btn-sm" disabled={!Number(add.amount)} onClick={addExpense}>Add</button>
        </div>
      </section>

      <section className="card viz-card viz-root">
        <div className="sum-row" style={{ alignItems: "center" }}>
          <h3>Net profit, last 6 months</h3>
          <button className="link-btn small" onClick={() => setTable((t) => !t)}>{table ? "Show as chart" : "Show as table"}</button>
        </div>
        {table ? (
          <table className="rota" style={{ minWidth: 0 }}>
            <thead><tr><th scope="col">Month</th><th scope="col">Revenue</th><th scope="col">Net profit</th></tr></thead>
            <tbody>{p.trend.map((t) => <tr key={t.month}><th scope="row">{label(t.month, true)}</th><td>{rupees(t.revenue)}</td><td>{money(t.net)}</td></tr>)}</tbody>
          </table>
        ) : (
          <div className="pnl-chart" role="img" aria-label={p.trend.map((t) => `${label(t.month, true)}: ${money(t.net)}`).join("; ")}>
            {p.trend.map((t) => (
              <div key={t.month} className="pnl-col" tabIndex={0} title={`${label(t.month, true)}: revenue ${rupees(t.revenue)}, net ${money(t.net)}`}>
                <div className="pnl-pos">{t.net > 0 && <span style={{ height: `${(t.net / max) * 100}%` }} />}</div>
                <div className="pnl-neg">{t.net < 0 && <span style={{ height: `${(-t.net / max) * 100}%` }} />}</div>
                <span className="tiny muted">{label(t.month)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
