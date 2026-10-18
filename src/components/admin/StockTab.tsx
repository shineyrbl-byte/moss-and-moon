"use client";
import { useCallback, useEffect, useState } from "react";
import ShopStock from "./ShopStock";
import Reorders from "./Reorders";
import { useStore } from "../Store";

type Ingredient = { id: string; name: string; unit: string; qty: number; low_at: number; cost: number | null; supplier_name?: string | null; supplier_email?: string | null; reorder_qty?: number | null };
// Costs are stored per g / ml / piece, but shown per kg / litre / piece
const PER: Record<string, { label: string; x: number }> = { g: { label: "₹ per kg", x: 1000 }, ml: { label: "₹ per litre", x: 1000 }, pcs: { label: "₹ each", x: 1 } };
const send = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const fmt = (n: number, unit: string) => (unit === "g" && n >= 1000 ? `${(n / 1000).toFixed(1)} kg` : unit === "ml" && n >= 1000 ? `${(n / 1000).toFixed(1)} L` : `${Math.round(n)} ${unit}`);
const STEP: Record<string, number> = { g: 1000, ml: 1000, pcs: 10 };

// Ingredient levels. Orders use them up automatically; anything a drink needs
// running out marks that drink sold out by itself.
export default function StockTab({ canEdit }: { canEdit: boolean }) {
  const { toast, refreshSoldOut } = useStore();
  const [items, setItems] = useState<Ingredient[]>([]);
  const [form, setForm] = useState({ name: "", unit: "pcs", qty: "", low_at: "" });

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/stock");
    if (r.ok) setItems(await r.json());
    refreshSoldOut();
  }, [refreshSoldOut]);
  useEffect(() => { load(); }, [load]);

  async function change(i: Ingredient, body: Record<string, unknown>, msg?: string) {
    const r = await fetch("/api/admin/stock", send("PATCH", { id: i.id, ...body }));
    if (!r.ok) return toast((await r.json()).error);
    if (msg) toast(msg);
    load();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/stock", send("POST", form));
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setForm({ name: "", unit: "pcs", qty: "", low_at: "" });
    toast("Now tracking it ✿");
    load();
  }

  const low = items.filter((i) => i.qty <= i.low_at);
  return (
    <>
      <ShopStock />
      <Reorders canEdit={canEdit} ingredients={items} onChange={load} />
      {low.length > 0 && <div className="reward-banner" style={{ marginBottom: "1rem" }}>⚠️ Running low: {low.map((i) => `${i.name} (${fmt(i.qty, i.unit)})`).join(", ")}</div>}
      <p className="muted small" style={{ marginBottom: "1rem" }}>
        Every order uses these up (size, milk choice and extra shots included). When something runs out, the drinks that need it show as sold out automatically.
      </p>
      <div className="stock-list">
        {items.map((i) => {
          const pct = Math.min(100, (i.qty / Math.max(i.low_at * 4, 1)) * 100);
          return (
            <div key={i.id} className={`stock-row card ${i.qty <= i.low_at ? "low" : ""}`}>
              <div className="stock-info">
                <strong>{i.name}</strong>
                <span className="small muted">{fmt(i.qty, i.unit)} left · low at {fmt(i.low_at, i.unit)}</span>
                <div className="meter" role="meter" aria-valuenow={Math.round(i.qty)} aria-valuemin={0} aria-label={`${i.name} level`}>
                  <span style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="row">
                <button className="chip" onClick={() => change(i, { add: STEP[i.unit] ?? 10 }, `+${fmt(STEP[i.unit] ?? 10, i.unit)} ${i.name}`)}>+ {fmt(STEP[i.unit] ?? 10, i.unit)}</button>
                <button className="chip" onClick={() => change(i, { qty: 0 }, `${i.name} marked as run out`)}>Ran out</button>
                {canEdit && (
                  <label className="stock-cost small">
                    <span className="muted">{(PER[i.unit] ?? PER.pcs).label}</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      step="1"
                      defaultValue={i.cost === null ? "" : Math.round(i.cost * (PER[i.unit] ?? PER.pcs).x * 100) / 100}
                      onBlur={(e) => {
                        if (e.target.value === "") return;
                        const per = Number(e.target.value) / (PER[i.unit] ?? PER.pcs).x;
                        if (per !== i.cost) change(i, { cost: per }, `Cost of ${i.name} saved`);
                      }}
                      aria-label={`${i.name} cost, ${(PER[i.unit] ?? PER.pcs).label}`}
                    />
                  </label>
                )}
                {canEdit && (
                  <button className="chip" onClick={() => {
                    const v = window.prompt?.(`Set ${i.name} to how many ${i.unit}?`, String(Math.round(i.qty)));
                    if (v !== null && v !== undefined && v !== "") change(i, { qty: Number(v) }, "Updated ✿");
                  }}>Set…</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {canEdit && (
        <form className="card row" style={{ padding: "1rem", marginTop: "1rem", alignItems: "flex-end" }} onSubmit={add}>
          <label className="field">Track something new<input className="input" placeholder="e.g. Croissants" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="field" style={{ maxWidth: "7rem" }}>Unit
            <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}><option value="pcs">pieces</option><option value="g">grams</option><option value="ml">ml</option></select>
          </label>
          <label className="field" style={{ maxWidth: "7rem" }}>In stock<input className="input" inputMode="numeric" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></label>
          <label className="field" style={{ maxWidth: "7rem" }}>Warn at<input className="input" inputMode="numeric" value={form.low_at} onChange={(e) => setForm({ ...form, low_at: e.target.value })} /></label>
          <button className="btn btn-sm">Add</button>
        </form>
      )}
      {canEdit && <p className="small muted" style={{ marginTop: "0.6rem" }}>Link items to ingredients in Menu → Edit → &quot;Uses&quot; (for example, 1 piece of Croissants per Butter Croissant).</p>}
    </>
  );
}
