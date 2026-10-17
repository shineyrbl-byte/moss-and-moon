"use client";
import { useCallback, useEffect, useState } from "react";
import { rupees } from "@/lib/pricing";

type Data = {
  days: number; orders: number; revenue: number; avgOrder: number; tips: number; items: number; guests: number; repeatRate: number;
  heat: number[][]; byCategory: Record<string, number>;
  options: { milk: Record<string, number>; size: Record<string, number>; temp: Record<string, number>; extraShot: number; drinks: number };
  channels: Record<"pickup" | "table" | "delivery", { orders: number; revenue: number }>;
  staff: { name: string; orders: number }[];
};
type Tip = { x: number; y: number; value: string; label: string } | null;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7am – 10pm
const hourLabel = (h: number) => (h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`);
const compact = (n: number) => (n >= 100000 ? `${(n / 100000).toFixed(1)}L` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
const pct = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : "0%");

/** Hover/focus readout. Values lead, labels follow. */
function useTip() {
  const [tip, setTip] = useState<Tip>(null);
  const bind = (value: string, label: string) => ({
    tabIndex: 0,
    onPointerMove: (e: React.PointerEvent) => setTip({ x: e.clientX, y: e.clientY, value, label }),
    onPointerLeave: () => setTip(null),
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      setTip({ x: r.left + r.width / 2, y: r.top, value, label });
    },
    onBlur: () => setTip(null),
    "aria-label": `${label}: ${value}`,
  });
  const el = tip && (
    <div className="viz-tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
      <strong>{tip.value}</strong>
      <span>{tip.label}</span>
    </div>
  );
  return { bind, el };
}

/** Single-series horizontal bars with the value at the tip */
function Bars({ rows, format, bind }: { rows: { label: string; value: number; note?: string }[]; format: (n: number) => string; bind: ReturnType<typeof useTip>["bind"] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="viz-bars">
      {rows.map((r) => (
        <div key={r.label} className="viz-bar-row" {...bind(format(r.value), r.note ? `${r.label} · ${r.note}` : r.label)}>
          <span className="viz-bar-label">{r.label}</span>
          <span className="viz-bar-track">
            <span className="viz-bar" style={{ width: `${(r.value / max) * 100}%` }} />
            <span className="viz-bar-value">{format(r.value)}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Every chart also has a plain table, so nothing depends on hovering or colour */
function TableView({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="viz-table">
      <summary>Show as table</summary>
      <table className="table">
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </details>
  );
}

export default function Analytics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const { bind, el } = useTip();

  const load = useCallback(async (d: number) => {
    setLoading(true);
    const r = await fetch(`/api/admin/analytics?days=${d}`);
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, []);
  useEffect(() => { load(days); }, [days, load]);

  if (!data) return <p className="muted">Crunching numbers…</p>;

  const maxHeat = Math.max(1, ...data.heat.flat());
  const step = (n: number) => (n === 0 ? 0 : Math.min(6, Math.ceil((n / maxHeat) * 6)));
  // Busiest slot, for the headline
  let peak = { d: 0, h: 0, n: 0 };
  data.heat.forEach((row, d) => row.forEach((n, h) => n > peak.n && (peak = { d, h, n })));
  const order = [1, 2, 3, 4, 5, 6, 0]; // Monday first

  const cat = [
    { label: "Coffee", value: data.byCategory.coffee ?? 0 },
    { label: "Tea & matcha", value: data.byCategory.tea ?? 0 },
    { label: "Bakes & sweets", value: data.byCategory.bakes ?? 0 },
  ];
  const catTotal = cat.reduce((s, c) => s + c.value, 0);
  const o = data.options;
  const milk = [
    { label: "Whole", value: o.milk.whole ?? 0 }, { label: "Oat", value: o.milk.oat ?? 0 },
    { label: "Almond", value: o.milk.almond ?? 0 }, { label: "No milk", value: o.milk.none ?? 0 },
  ];
  const size = [{ label: "Small", value: o.size.small ?? 0 }, { label: "Regular", value: o.size.regular ?? 0 }, { label: "Large", value: o.size.large ?? 0 }];
  const temp = [{ label: "Hot", value: o.temp.hot ?? 0 }, { label: "Iced", value: o.temp.iced ?? 0 }];
  const ch = [
    { label: "Pick up", value: data.channels.pickup.orders, note: rupees(data.channels.pickup.revenue) },
    { label: "At a table", value: data.channels.table.orders, note: rupees(data.channels.table.revenue) },
    { label: "Delivery", value: data.channels.delivery.orders, note: rupees(data.channels.delivery.revenue) },
  ];
  const cups = (n: number) => `${n} cup${n === 1 ? "" : "s"}`;

  return (
    <div className={`viz-root ${loading ? "is-loading" : ""}`}>
      <div className="chips" style={{ justifyContent: "flex-start", marginBottom: "1rem" }} role="radiogroup" aria-label="Date range">
        {[7, 30, 90].map((d) => (
          <button key={d} className={`chip ${days === d ? "on" : ""}`} role="radio" aria-checked={days === d} onClick={() => setDays(d)}>Last {d} days</button>
        ))}
      </div>

      <div className="kpis">
        <div className="kpi card"><span>Revenue</span><strong>{rupees(data.revenue)}</strong><small className="muted">{data.orders} orders</small></div>
        <div className="kpi card"><span>Average order</span><strong>{rupees(data.avgOrder)}</strong><small className="muted">{data.items} items sold</small></div>
        <div className="kpi card"><span>Guests who came back</span><strong>{data.repeatRate}%</strong><small className="muted">of {data.guests} known guests</small></div>
        <div className="kpi card"><span>Tips for the team</span><strong>{rupees(data.tips)}</strong><small className="muted">last {data.days} days</small></div>
      </div>

      <section className="card viz-card">
        <h3>Busiest hours</h3>
        <p className="small muted">{peak.n ? `Busiest: ${DAYS[peak.d]} around ${hourLabel(peak.h)}m (${peak.n} orders). Plan an extra pair of hands then.` : "No orders in this period yet."}</p>
        <div className="heat" role="grid" aria-label="Orders by weekday and hour">
          <span />
          {HOURS.map((h) => <span key={h} className="heat-h">{h % 2 ? "" : hourLabel(h)}</span>)}
          {order.map((d) => (
            <div key={d} className="heat-row" role="row">
              <span className="heat-d">{DAYS[d]}</span>
              {HOURS.map((h) => {
                const n = data.heat[d][h];
                return <span key={h} role="gridcell" className={`heat-cell s${step(n)}`} {...bind(`${n} order${n === 1 ? "" : "s"}`, `${DAYS[d]} ${hourLabel(h)}m`)} />;
              })}
            </div>
          ))}
        </div>
        <div className="heat-legend small muted">
          Fewer <span className="heat-cell s0" /><span className="heat-cell s1" /><span className="heat-cell s3" /><span className="heat-cell s5" /><span className="heat-cell s6" /> More orders
        </div>
        <TableView head={["Day", ...HOURS.map((h) => `${hourLabel(h)}m`)]} rows={order.map((d) => [DAYS[d], ...HOURS.map((h) => data.heat[d][h])])} />
      </section>

      <div className="viz-grid">
        <section className="card viz-card">
          <h3>Sales by category</h3>
          <Bars rows={cat} format={(n) => rupees(n)} bind={bind} />
          <TableView head={["Category", "Sales", "Share"]} rows={cat.map((c) => [c.label, rupees(c.value), pct(c.value, catTotal)])} />
        </section>
        <section className="card viz-card">
          <h3>How guests order</h3>
          <Bars rows={ch} format={(n) => `${n} orders`} bind={bind} />
          <TableView head={["Channel", "Orders", "Sales"]} rows={ch.map((c) => [c.label, c.value, c.note])} />
        </section>
        <section className="card viz-card">
          <h3>Milk choices</h3>
          <Bars rows={milk} format={cups} bind={bind} />
          <TableView head={["Milk", "Cups", "Share"]} rows={milk.map((m) => [m.label, m.value, pct(m.value, o.drinks)])} />
        </section>
        <section className="card viz-card">
          <h3>Sizes, hot or iced</h3>
          <Bars rows={size} format={cups} bind={bind} />
          <div style={{ height: "0.8rem" }} />
          <Bars rows={temp} format={cups} bind={bind} />
          <p className="small muted" style={{ marginTop: "0.6rem" }}>☕ Extra shot in {pct(o.extraShot, o.drinks)} of {compact(o.drinks)} drinks</p>
          <TableView head={["Option", "Cups"]} rows={[...size, ...temp].map((r) => [r.label, r.value]).concat([["Extra shot", o.extraShot]])} />
        </section>
        {data.staff.length > 0 && (
          <section className="card viz-card">
            <h3>Orders started by</h3>
            <Bars rows={data.staff.map((s) => ({ label: s.name, value: s.orders }))} format={(n) => `${n} orders`} bind={bind} />
          </section>
        )}
      </div>
      {el}
    </div>
  );
}
