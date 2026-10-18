"use client";
import { useEffect, useState } from "react";
import { rupees } from "@/lib/pricing";

type Report = {
  days: number; revenue: number; cost: number; waste: number; profit: number; margin: number; estimatedShare: number;
  daily: { day: string; revenue: number; profit: number }[];
  items: { name: string; qty: number; revenue: number; cost: number; profit: number; margin: number; guessed: boolean }[];
};

/** Owner: what the café keeps after ingredient and packaging costs */
export default function ProfitPanel() {
  const [days, setDays] = useState(30);
  const [r, setR] = useState<Report | null>(null);
  const [table, setTable] = useState(false);
  const [tip, setTip] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/admin/profit?days=${days}`).then((x) => x.json()).then(setR).catch(() => {});
  }, [days]);

  if (!r) return <p className="muted">Loading profit…</p>;
  const max = Math.max(1, ...r.daily.map((d) => Math.abs(d.profit)));
  const worst = [...r.items].filter((i) => i.qty >= 3).sort((a, b) => a.margin - b.margin).slice(0, 3);
  const dayLabel = (d: string) => new Date(d + "T12:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return (
    <section className="card viz-card viz-root">
      <div className="sum-row" style={{ alignItems: "center", flexWrap: "wrap", gap: "0.6rem" }}>
        <h3>💰 Profit</h3>
        <div className="chips" role="radiogroup" aria-label="Time range">
          {[7, 30, 90].map((d) => <button key={d} role="radio" aria-checked={days === d} className={`chip ${days === d ? "on" : ""}`} onClick={() => setDays(d)}>{d} days</button>)}
        </div>
      </div>
      <div className="kpis" style={{ marginTop: "0.8rem" }}>
        <div className="kpi card"><span>Sales kept</span><strong>{rupees(r.revenue)}</strong><small className="muted">after discounts & refunds</small></div>
        <div className="kpi card"><span>Costs</span><strong>{rupees(r.cost + r.waste)}</strong><small className="muted">ingredients, cups{r.waste ? `, ${rupees(r.waste)} waste` : ""}</small></div>
        <div className="kpi card"><span>Gross profit</span><strong>{rupees(r.profit)}</strong><small className="muted">{r.margin}% margin</small></div>
      </div>

      <div className="sum-row" style={{ marginTop: "1rem" }}>
        <b className="small">Profit per day</b>
        <button className="link-btn small" onClick={() => setTable((t) => !t)}>{table ? "Show as chart" : "Show as table"}</button>
      </div>
      {table ? (
        <div className="rota-wrap" style={{ marginTop: "0.5rem" }}>
          <table className="rota" style={{ minWidth: 0 }}>
            <thead><tr><th scope="col">Day</th><th scope="col">Sales</th><th scope="col">Profit</th></tr></thead>
            <tbody>{r.daily.filter((d) => d.revenue).map((d) => <tr key={d.day}><td>{dayLabel(d.day)}</td><td>{rupees(d.revenue)}</td><td>{rupees(d.profit)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="profit-bars" onMouseLeave={() => setTip(null)}>
          {r.daily.map((d, i) => (
            <div key={d.day} className="profit-col" tabIndex={0} role="img" onMouseEnter={() => setTip(i)} onFocus={() => setTip(i)} aria-label={`${dayLabel(d.day)}: ${rupees(d.profit)} profit on ${rupees(d.revenue)} sales`}>
              <span className={`profit-bar ${d.profit < 0 ? "neg" : ""}`} style={{ height: `${Math.max(d.profit ? 3 : 0, (Math.abs(d.profit) / max) * 100)}%` }} />
            </div>
          ))}
          {tip !== null && (
            <div className="busy-tip" style={{ left: `${((tip + 0.5) / r.daily.length) * 100}%`, top: 0 }}>
              <b>{rupees(r.daily[tip].profit)}</b> · {dayLabel(r.daily[tip].day)}
            </div>
          )}
        </div>
      )}

      <b className="small" style={{ display: "block", marginTop: "1rem" }}>By item</b>
      {worst.length > 0 && worst[0].margin < 55 && (
        <p className="small reward-banner" style={{ marginTop: "0.4rem" }}>🏷 Lowest margins: {worst.map((w) => `${w.name} (${w.margin}%)`).join(", ")}. Worth checking their price or recipe.</p>
      )}
      <div className="rota-wrap" style={{ marginTop: "0.5rem" }}>
        <table className="rota" style={{ minWidth: 520 }}>
          <thead><tr><th scope="col">Item</th><th scope="col">Sold</th><th scope="col">Sales</th><th scope="col">Cost</th><th scope="col">Profit</th><th scope="col">Margin</th></tr></thead>
          <tbody>
            {r.items.slice(0, 15).map((i) => (
              <tr key={i.name}>
                <th scope="row">{i.name}{i.guessed ? " *" : ""}</th>
                <td>{i.qty}</td><td>{rupees(i.revenue)}</td><td>{rupees(i.cost)}</td><td><b>{rupees(i.profit)}</b></td><td>{i.margin}%</td>
              </tr>
            ))}
            {!r.items.length && <tr><td colSpan={6} className="muted">No orders in this period yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="tiny muted" style={{ marginTop: "0.5rem" }}>
        Costs come from Admin → Stock (ingredients) and each item&apos;s “cost to make” in the menu editor, plus ₹6 per cup for packaging.
        {r.estimatedShare > 0 ? ` * Bakes without a cost are guessed at 35% of their price (${r.estimatedShare}% of lines). Add real costs for exact numbers.` : ""}
      </p>
    </section>
  );
}
