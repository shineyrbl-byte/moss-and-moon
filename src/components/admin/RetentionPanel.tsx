"use client";
import { useEffect, useState } from "react";

type M = { month: string; newGuests: number; returned: number; tooSoon: number; rate: number };

/** Owner: how many new guests come back within 30 days, month by month */
export default function RetentionPanel() {
  const [months, setMonths] = useState<M[] | null>(null);
  const [table, setTable] = useState(false);
  useEffect(() => {
    fetch("/api/admin/retention").then((r) => r.json()).then((d) => setMonths(d.months)).catch(() => {});
  }, []);
  if (!months) return null;
  const label = (m: string) => new Date(m + "-01T12:00").toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  return (
    <section className="card viz-card viz-root">
      <div className="sum-row" style={{ alignItems: "center" }}>
        <h3>🔁 Coming back</h3>
        <button className="link-btn small" onClick={() => setTable((t) => !t)}>{table ? "Show as chart" : "Show as table"}</button>
      </div>
      <p className="small muted">Of the guests who first ordered each month, how many ordered again within 30 days.</p>
      {!months.length ? <p className="small muted">Not enough orders yet.</p> : table ? (
        <div className="rota-wrap" style={{ marginTop: "0.5rem" }}>
          <table className="rota" style={{ minWidth: 0 }}>
            <thead><tr><th scope="col">Month</th><th scope="col">New guests</th><th scope="col">Came back</th><th scope="col">Rate</th></tr></thead>
            <tbody>{months.map((m) => <tr key={m.month}><td>{label(m.month)}</td><td>{m.newGuests}</td><td>{m.returned}</td><td>{m.rate}%{m.tooSoon ? ` (${m.tooSoon} still too new)` : ""}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="viz-bars">
          {months.map((m) => (
            <div key={m.month} className="viz-bar-row" tabIndex={0} title={`${label(m.month)}: ${m.returned} of ${m.newGuests} new guests came back (${m.rate}%)`}>
              <span className="viz-bar-label">{label(m.month)}</span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className="viz-bar" style={{ width: `${Math.max(2, m.rate)}%`, height: 14, borderRadius: "0 4px 4px 0", background: "var(--viz-bar)", display: "inline-block" }} />
                <span className="small"><b>{m.rate}%</b> <span className="muted">· {m.returned}/{m.newGuests}{m.tooSoon ? `, ${m.tooSoon} too new` : ""}</span></span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
