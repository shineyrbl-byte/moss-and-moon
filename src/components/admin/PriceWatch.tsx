"use client";
import { useEffect, useState } from "react";
import { rupees } from "@/lib/pricing";

type P = { id: string; name: string; unit: string; cost: number; was: number; change: number; monthly: number; alert: boolean; history: { cost: number; at: string; note: string | null }[] };
const PER: Record<string, { label: string; x: number }> = { g: { label: "/kg", x: 1000 }, ml: { label: "/L", x: 1000 }, pcs: { label: " each", x: 1 } };
const show = (c: number, unit: string) => `${rupees(Math.round(c * (PER[unit] ?? PER.pcs).x * 100) / 100)}${(PER[unit] ?? PER.pcs).label}`;

/** Owner, Stock tab: supplier prices that changed, and what that does to monthly costs */
export default function PriceWatch() {
  const [d, setD] = useState<{ items: P[]; alertAt: number } | null>(null);
  useEffect(() => { fetch("/api/admin/prices").then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => {}); }, []);
  if (!d) return null;
  const changed = d.items.filter((i) => i.change !== 0);
  return (
    <section className="card" style={{ padding: "1.1rem 1.2rem", marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "1.3rem" }}>💹 Supplier prices</h3>
      <p className="small muted">When a delivery costs more or less, change the price on the ingredient below. Profit numbers update by themselves, and rises of {d.alertAt}% or more over 3 months are flagged here.</p>
      {!changed.length ? <p className="small muted">No price changes yet.</p> : (
        <div className="rota-wrap">
          <table className="rota" style={{ minWidth: 0 }}>
            <thead><tr><th scope="col">Ingredient</th><th scope="col">Then</th><th scope="col">Now</th><th scope="col">Change</th><th scope="col">Effect a month</th></tr></thead>
            <tbody>
              {changed.map((i) => (
                <tr key={i.id} title={i.history.map((h) => `${h.at}: ${show(h.cost, i.unit)}${h.note ? ` (${h.note})` : ""}`).join("\n")}>
                  <th scope="row">{i.alert && "⚠️ "}{i.name}</th>
                  <td>{show(i.was, i.unit)}</td>
                  <td>{show(i.cost, i.unit)}</td>
                  <td className={i.change > 0 ? "cashup-bad" : "success"}>{i.change > 0 ? "+" : ""}{i.change}%</td>
                  <td>{i.monthly === 0 ? "–" : `${i.monthly > 0 ? "+" : "−"}${rupees(Math.abs(i.monthly))}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {changed.some((i) => i.alert) && <p className="small" style={{ marginTop: "0.5rem" }}>Worth asking the supplier, or trying the price “what if” in Analytics for drinks that use it.</p>}
    </section>
  );
}
