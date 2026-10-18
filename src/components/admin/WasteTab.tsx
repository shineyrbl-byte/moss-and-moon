"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { rupees } from "@/lib/pricing";
import { useStore } from "../Store";

type Plan = { itemId: string; name: string; avgSold: number | null; avgWaste: number | null; suggest: number | null };
type Data = {
  today: string; planFor: string; plan: Plan[];
  entries: { id: number; item_name: string; qty: number; reason: string; cost: number; created_at: string }[];
  history: { day: string; qty: number; cost: number }[];
};
const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** Closing time: log leftover bakes, and see how many to bake tomorrow */
export default function WasteTab() {
  const { toast, menu } = useStore();
  const [d, setD] = useState<Data | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("leftover");

  const load = useCallback(() => fetch("/api/admin/waste").then((r) => r.json()).then(setD).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const bakes = useMemo(() => menu.filter((m) => m.cat === "bakes"), [menu]);

  async function save() {
    const entries = Object.entries(counts).filter(([, q]) => q > 0).map(([itemId, qty]) => ({ itemId, qty, reason }));
    const r = await fetch("/api/admin/waste", json("POST", { entries }));
    const x = await r.json();
    if (!r.ok) return toast(x.error);
    toast(`Logged ${x.logged} item${x.logged === 1 ? "" : "s"} ✓`);
    setCounts({});
    load();
  }
  async function undo(id: number) {
    await fetch("/api/admin/waste", json("DELETE", { id }));
    load();
  }

  if (!d) return <p className="muted">Loading…</p>;
  const totalToday = d.entries.reduce((s, e) => s + e.cost, 0);
  const planDay = new Date(d.planFor + "T12:00").toLocaleDateString("en-IN", { weekday: "long" });
  const hasHistory = d.plan.some((p) => p.avgSold !== null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
      <section className="card" style={{ padding: "1.1rem 1.2rem" }}>
        <div className="sum-row" style={{ alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <h3 style={{ fontSize: "1.3rem" }}>🧺 What&apos;s left today?</h3>
          <label className="row small" style={{ alignItems: "center", gap: "0.4rem" }}>Reason
            <select className="input" style={{ width: "auto" }} value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="leftover">Left over at closing</option><option value="dropped">Dropped / damaged</option><option value="expired">Past its best</option><option value="other">Other</option>
            </select>
          </label>
        </div>
        <div className="waste-grid">
          {bakes.map((m) => (
            <div key={m.id} className="waste-item">
              <span className="small">{m.name}</span>
              <div className="stepper">
                <button onClick={() => setCounts((c) => ({ ...c, [m.id]: Math.max(0, (c[m.id] ?? 0) - 1) }))} aria-label={`One less ${m.name}`}>−</button>
                <strong aria-live="polite">{counts[m.id] ?? 0}</strong>
                <button onClick={() => setCounts((c) => ({ ...c, [m.id]: Math.min(200, (c[m.id] ?? 0) + 1) }))} aria-label={`One more ${m.name}`}>+</button>
              </div>
            </div>
          ))}
        </div>
        <button className="btn btn-pink btn-sm" style={{ marginTop: "0.8rem" }} disabled={!Object.values(counts).some((q) => q > 0)} onClick={save}>Log it</button>
        {d.entries.length > 0 && (
          <ul className="backup-list" style={{ marginTop: "0.8rem" }}>
            {d.entries.map((e) => (
              <li key={e.id}><span>{e.qty} × {e.item_name} <span className="muted">· {e.reason}</span></span><span className="muted">{rupees(Math.round(e.cost))}</span><button className="link-btn" onClick={() => undo(e.id)}>Undo</button></li>
            ))}
            <li><b>Today</b><b>{rupees(Math.round(totalToday))}</b><span /></li>
          </ul>
        )}
      </section>

      <section className="card" style={{ padding: "1.1rem 1.2rem" }}>
        <h3 style={{ fontSize: "1.3rem" }}>🥐 Bake plan for {planDay}</h3>
        <p className="small muted">{hasHistory ? `Based on the last 4 ${planDay}s: what sold, plus a small buffer (less if a lot got thrown away).` : "Not enough history yet. After a few weeks of orders and waste logs, suggestions appear here."}</p>
        {hasHistory && (
          <div className="rota-wrap" style={{ marginTop: "0.6rem" }}>
            <table className="rota" style={{ minWidth: 420 }}>
              <thead><tr><th scope="col">Bake</th><th scope="col">Usually sells</th><th scope="col">Usually wasted</th><th scope="col">Bake</th></tr></thead>
              <tbody>
                {d.plan.map((p) => (
                  <tr key={p.itemId}><th scope="row">{p.name}</th><td>{p.avgSold ?? "–"}</td><td>{p.avgWaste ?? "–"}</td><td><b>{p.suggest ?? "–"}</b></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {d.history.length > 0 && (
        <p className="small muted">Last 14 days: {d.history.reduce((s, h) => s + h.qty, 0)} items thrown away, about {rupees(d.history.reduce((s, h) => s + h.cost, 0))}.</p>
      )}
    </div>
  );
}
