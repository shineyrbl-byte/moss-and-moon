"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";

type G = { on: boolean; gstin: string; legalName: string; address: string; rate: number; prefix: string };

/** Owner: GST tax invoices on receipts, and a monthly report */
export default function GstCard() {
  const { toast } = useStore();
  const [g, setG] = useState<G | null>(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  useEffect(() => {
    fetch("/api/admin/gst").then((r) => r.json()).then(setG).catch(() => {});
  }, []);
  if (!g) return null;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/gst", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(g) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setG(d);
    toast(d.on ? "Receipts are now GST tax invoices ✓" : "Saved");
  }
  return (
    <form className="card" onSubmit={save} style={{ padding: "1.2rem 1.3rem", display: "flex", flexDirection: "column", gap: "0.7rem" }}>
      <div className="sum-row" style={{ alignItems: "center" }}>
        <h3 style={{ fontSize: "1.3rem" }}>🧾 GST invoices</h3>
        <button type="button" className={`switch ${g.on ? "" : "off"}`} onClick={() => setG({ ...g, on: !g.on })} aria-pressed={g.on} aria-label="GST invoices on" />
      </div>
      <p className="small muted">When on, every paid order&apos;s receipt becomes a tax invoice with your GSTIN, a running invoice number and the CGST/SGST inside the price. Menu prices stay the same (they include GST).</p>
      {g.on && (
        <>
          <div className="row">
            <label className="field">GSTIN<input className="input" maxLength={15} value={g.gstin} onChange={(e) => setG({ ...g, gstin: e.target.value.toUpperCase() })} placeholder="30ABCDE1234F1Z5" /></label>
            <label className="field">GST rate
              <select className="input" value={g.rate} onChange={(e) => setG({ ...g, rate: Number(e.target.value) })}>
                <option value={5}>5% (most cafés)</option><option value={12}>12%</option><option value={18}>18%</option><option value={0}>0% (exempt)</option>
              </select>
            </label>
            <label className="field" style={{ maxWidth: "7rem" }}>Invoice prefix<input className="input" maxLength={6} value={g.prefix} onChange={(e) => setG({ ...g, prefix: e.target.value.toUpperCase() })} /></label>
          </div>
          <label className="field">Legal name (as on your GST registration)<input className="input" maxLength={80} value={g.legalName} onChange={(e) => setG({ ...g, legalName: e.target.value })} /></label>
          <label className="field">Registered address<input className="input" maxLength={160} value={g.address} onChange={(e) => setG({ ...g, address: e.target.value })} /></label>
        </>
      )}
      <div className="row" style={{ alignItems: "center" }}>
        <button className="btn btn-sm">Save</button>
        {g.on && (
          <>
            <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Report month" style={{ maxWidth: 170 }} />
            <a className="btn btn-ghost btn-sm" href={`/api/admin/gst?report=${month}`}>⬇ GST report (CSV)</a>
          </>
        )}
      </div>
      <p className="tiny muted">Please check the rate and details with your accountant. Restaurants usually charge 5% without input tax credit.</p>
    </form>
  );
}
