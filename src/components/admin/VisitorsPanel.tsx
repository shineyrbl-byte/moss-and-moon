"use client";
import { useEffect, useState } from "react";

type R = {
  days: number; visitors: number; views: number; orders: number; conversion: number;
  daily: { day: string; visitors: number; views: number; orders: number }[];
  pages: { path: string; n: number }[]; referrers: { ref: string; n: number }[]; devices: { device: string; n: number }[];
};
const PAGE_NAMES: Record<string, string> = { "/": "Home", "/order/[code]": "Order tracking", "/account": "Account", "/gift-cards": "Gift cards", "/loyalty": "Stamp card", "/orders": "My orders", "/noticeboard": "Noticeboard", "/gift-a-drink": "Buy a friend a coffee", "/g/new": "Start a group order", "/g/[group]": "Group order", "/d/[gift]": "Gifted drink", "/ticket/[code]": "Event ticket", "/t/[table]": "Table QR" };

/** Owner: who visits, from where, and how many order */
export default function VisitorsPanel() {
  const [days, setDays] = useState(30);
  const [r, setR] = useState<R | null>(null);
  const [tip, setTip] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  useEffect(() => {
    fetch(`/api/admin/visitors?days=${days}`).then((x) => x.json()).then(setR).catch(() => {});
  }, [days]);
  if (!r) return null;
  const max = Math.max(1, ...r.daily.map((d) => d.visitors));
  const devTotal = r.devices.reduce((s, d) => s + d.n, 0) || 1;
  const label = (d: string) => new Date(d + "T12:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return (
    <section className="card viz-card viz-root">
      <div className="sum-row" style={{ alignItems: "center", flexWrap: "wrap", gap: "0.6rem" }}>
        <h3>👀 Visitors</h3>
        <div className="chips" role="radiogroup" aria-label="Time range">
          {[7, 30, 90].map((d) => <button key={d} role="radio" aria-checked={days === d} className={`chip ${days === d ? "on" : ""}`} onClick={() => setDays(d)}>{d} days</button>)}
        </div>
      </div>
      <div className="kpis" style={{ marginTop: "0.8rem" }}>
        <div className="kpi card"><span>Visitors</span><strong>{r.visitors.toLocaleString("en-IN")}</strong><small className="muted">counted once a day</small></div>
        <div className="kpi card"><span>Page views</span><strong>{r.views.toLocaleString("en-IN")}</strong></div>
        <div className="kpi card"><span>Ordered</span><strong>{r.conversion}%</strong><small className="muted">{r.orders} orders ÷ visitors</small></div>
      </div>
      <div className="sum-row" style={{ marginTop: "1rem" }}>
        <b className="small">Visitors per day</b>
        <button className="link-btn small" onClick={() => setTable((t) => !t)}>{table ? "Show as chart" : "Show as table"}</button>
      </div>
      {table ? (
        <div className="rota-wrap" style={{ marginTop: "0.5rem" }}>
          <table className="rota" style={{ minWidth: 0 }}>
            <thead><tr><th scope="col">Day</th><th scope="col">Visitors</th><th scope="col">Views</th><th scope="col">Orders</th></tr></thead>
            <tbody>{r.daily.filter((d) => d.visitors || d.orders).map((d) => <tr key={d.day}><td>{label(d.day)}</td><td>{d.visitors}</td><td>{d.views}</td><td>{d.orders}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="profit-bars" onMouseLeave={() => setTip(null)}>
          {r.daily.map((d, i) => (
            <div key={d.day} className="profit-col" tabIndex={0} role="img" onMouseEnter={() => setTip(i)} onFocus={() => setTip(i)} aria-label={`${label(d.day)}: ${d.visitors} visitors, ${d.orders} orders`}>
              <span className="profit-bar" style={{ height: `${Math.max(d.visitors ? 3 : 0, (d.visitors / max) * 100)}%` }} />
            </div>
          ))}
          {tip !== null && (
            <div className="busy-tip" style={{ left: `${((tip + 0.5) / r.daily.length) * 100}%`, top: 0 }}>
              <b>{r.daily[tip].visitors}</b> visitors · {r.daily[tip].orders} orders · {label(r.daily[tip].day)}
            </div>
          )}
        </div>
      )}
      <div className="insight-cols" style={{ marginTop: "1rem" }}>
        <div>
          <b className="small">Top pages</b>
          <ol className="small viz-list">{r.pages.map((p) => <li key={p.path}><span>{PAGE_NAMES[p.path] ?? p.path}</span><b>{p.n}</b></li>)}{!r.pages.length && <li className="muted">No visits yet</li>}</ol>
        </div>
        <div>
          <b className="small">Came from</b>
          <ol className="small viz-list">{r.referrers.map((p) => <li key={p.ref}><span>{p.ref}</span><b>{p.n}</b></li>)}{!r.referrers.length && <li className="muted">Mostly direct visits so far</li>}</ol>
        </div>
        <div>
          <b className="small">Devices</b>
          <ol className="small viz-list">{r.devices.map((d) => <li key={d.device}><span>{d.device === "phone" ? "📱 Phone" : d.device === "tablet" ? "📲 Tablet" : "💻 Computer"}</span><b>{Math.round((d.n / devTotal) * 100)}%</b></li>)}</ol>
        </div>
      </div>
      <p className="tiny muted" style={{ marginTop: "0.5rem" }}>No cookies or trackers: visitors are counted with a code that changes every day, and staff pages and bots aren&apos;t counted.</p>
    </section>
  );
}
