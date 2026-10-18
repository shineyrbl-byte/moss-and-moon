"use client";
import { useCallback, useEffect, useState } from "react";
import { rupees } from "@/lib/pricing";
import { useStore } from "../Store";

type C = { day: string; float_start: number; cash: number; upi: number; card: number; expected: number; note: string | null; staff_name: string | null; difference: number };
type Data = { day: string; expected: number; orders: number; unpaid: number; cashup: C | null; history: C[] };
const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const diffText = (d: number) => (d === 0 ? "Spot on ✓" : d > 0 ? `${rupees(d)} over` : `${rupees(-d)} short`);

/** Closing time: count the till and see whether it matches what the counter took */
export default function CashupTab() {
  const { toast } = useStore();
  const [d, setD] = useState<Data | null>(null);
  const [f, setF] = useState({ float: "", cash: "", upi: "", card: "", note: "" });
  const load = useCallback(() => fetch("/api/admin/cashup").then((r) => r.json()).then((x: Data) => {
    setD(x);
    const c = x.cashup ?? x.history[0];
    // Start from today's saved count, or yesterday's opening float
    if (x.cashup) setF({ float: String(c!.float_start), cash: String(c!.cash), upi: String(c!.upi), card: String(c!.card), note: c!.note ?? "" });
    else if (c) setF((v) => ({ ...v, float: v.float || String(c.float_start) }));
  }).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  if (!d) return <p className="muted">Loading…</p>;
  const n = (s: string) => Number(s) || 0;
  const live = Math.round(n(f.cash) - n(f.float) + n(f.upi) + n(f.card) - d.expected);
  async function save() {
    const r = await fetch("/api/admin/cashup", json("POST", f));
    const x = await r.json();
    if (!r.ok) return toast(x.error);
    toast(`Cash-up saved: ${diffText(x.cashup.difference)}`);
    load();
  }
  const field = (k: keyof typeof f, label: string, hint?: string) => (
    <label className="field">
      <span>{label}{hint && <span className="muted small"> · {hint}</span>}</span>
      <input className="input" inputMode="decimal" value={f[k]} onChange={(e) => setF((v) => ({ ...v, [k]: e.target.value.replace(/[^\d.]/g, "") }))} placeholder="0" />
    </label>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
      <section className="card" style={{ padding: "1.1rem 1.2rem" }}>
        <h3 style={{ fontSize: "1.3rem" }}>💵 Cash-up for today</h3>
        <p className="small muted">The counter should have taken <b>{rupees(d.expected)}</b> from {d.orders} order{d.orders === 1 ? "" : "s"} paid at the counter (after counter refunds). Online payments aren&apos;t counted here.</p>
        {d.unpaid > 0 && <p className="small diet-warn">⚠️ {d.unpaid} counter order{d.unpaid === 1 ? " is" : "s are"} still marked unpaid today. Mark them paid first, or the count will look over.</p>}
        <div className="cashup-grid">
          {field("float", "Opening float", "cash in the till this morning")}
          {field("cash", "Cash counted now")}
          {field("upi", "UPI received")}
          {field("card", "Card machine total")}
        </div>
        <label className="field"><span>Note <span className="muted small">· optional, e.g. why it's short</span></span>
          <input className="input" value={f.note} maxLength={300} onChange={(e) => setF((v) => ({ ...v, note: e.target.value }))} />
        </label>
        <div className="sum-row" style={{ alignItems: "center", marginTop: "0.8rem" }}>
          <span className={`cashup-diff ${live === 0 ? "ok" : Math.abs(live) <= 50 ? "near" : "off"}`} aria-live="polite">{diffText(live)}</span>
          <button className="btn btn-pink btn-sm" onClick={save}>{d.cashup ? "Update cash-up" : "Save cash-up"}</button>
        </div>
        {d.cashup && <p className="tiny muted">Saved by {d.cashup.staff_name ?? "staff"}. Saving again replaces it.</p>}
      </section>

      {d.history.length > 0 && (
        <section className="card" style={{ padding: "1.1rem 1.2rem" }}>
          <h3 style={{ fontSize: "1.1rem" }}>Last two weeks</h3>
          <div className="rota-wrap" style={{ marginTop: "0.5rem" }}>
            <table className="rota" style={{ minWidth: 0 }}>
              <thead><tr><th scope="col">Day</th><th scope="col">Expected</th><th scope="col">Counted</th><th scope="col">Result</th><th scope="col">By</th></tr></thead>
              <tbody>
                {d.history.map((c) => (
                  <tr key={c.day}>
                    <th scope="row">{new Date(c.day + "T12:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</th>
                    <td>{rupees(Math.round(c.expected))}</td>
                    <td>{rupees(Math.round(c.cash - c.float_start + c.upi + c.card))}</td>
                    <td className={c.difference === 0 ? "" : "cashup-bad"}>{diffText(c.difference)}{c.note ? <span className="muted small"> · {c.note}</span> : ""}</td>
                    <td className="small muted">{c.staff_name ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
