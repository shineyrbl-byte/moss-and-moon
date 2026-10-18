"use client";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "../Store";

type PO = { id: number; ingredient_id: string; qty: number; status: string; created_at: string; sent_at: string | null; received_at: string | null; name: string; unit: string; in_stock: number; supplier_name: string | null; supplier_email: string | null };
type Ing = { id: string; name: string; unit: string; qty: number; low_at: number; supplier_name?: string | null; supplier_email?: string | null; reorder_qty?: number | null };
const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const fmt = (n: number, unit: string) => (unit === "g" && n >= 1000 ? `${n / 1000} kg` : unit === "ml" && n >= 1000 ? `${n / 1000} L` : `${Math.round(n)} ${unit}`);

/** Draft orders for suppliers when stock runs low; approve to email them */
export default function Reorders({ canEdit, ingredients, onChange }: { canEdit: boolean; ingredients: Ing[]; onChange: () => void }) {
  const { toast } = useStore();
  const [pos, setPos] = useState<PO[] | null>(null);
  const [qty, setQty] = useState<Record<number, string>>({});
  const [showSuppliers, setShowSuppliers] = useState(false);
  const [edit, setEdit] = useState<Record<string, { supplier_name: string; supplier_email: string; reorder_qty: string }>>({});

  const load = useCallback(() => fetch("/api/admin/reorders").then((r) => r.json()).then(setPos).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  async function act(id: number, action: string) {
    const r = await fetch("/api/admin/reorders", json("PATCH", { id, action, qty: Number(qty[id]) || undefined }));
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    toast(action === "send" ? "Sent to the supplier ✓" : action === "receive" ? "Restocked ✓" : "Dismissed");
    load();
    onChange();
  }
  async function saveSupplier(i: Ing) {
    const e = edit[i.id];
    const r = await fetch("/api/admin/stock", json("PATCH", { id: i.id, supplier_name: e.supplier_name, supplier_email: e.supplier_email, reorder_qty: Number(e.reorder_qty) || null }));
    if (!r.ok) return toast((await r.json()).error);
    toast(`Supplier for ${i.name} saved ✓`);
    onChange();
  }
  async function startOrder(i: Ing) {
    const r = await fetch("/api/admin/reorders", json("POST", { ingredientId: i.id }));
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    load();
  }

  const open = pos?.filter((p) => p.status === "draft" || p.status === "sent") ?? [];
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <div className="sum-row" style={{ alignItems: "center" }}>
        <h3 style={{ fontSize: "1.2rem" }}>📦 Reorders</h3>
        {canEdit && <button className="link-btn small" onClick={() => setShowSuppliers((v) => !v)}>{showSuppliers ? "Hide suppliers" : "Suppliers…"}</button>}
      </div>
      {!open.length && <p className="small muted">Nothing to order. When something with a supplier runs low, a draft order appears here for you to approve.</p>}
      {open.map((p) => (
        <div key={p.id} className="promo-row" style={{ padding: "0.5rem 0", borderTop: "1px solid var(--line)" }}>
          <div>
            <b>{p.name}</b> <span className={`status-tag ${p.status === "sent" ? "promo-live" : ""}`}>{p.status === "draft" ? "waiting for you" : "ordered"}</span>
            <p className="small muted">{fmt(p.in_stock, p.unit)} left · from {p.supplier_name || p.supplier_email || "no supplier yet"}{p.sent_at ? ` · sent ${p.sent_at.slice(5, 16)}` : ""}</p>
          </div>
          <div className="row" style={{ alignItems: "center", gap: "0.4rem" }}>
            <input className="input" style={{ width: "6.5rem" }} type="number" min={1} placeholder={String(p.qty)} value={qty[p.id] ?? ""} onChange={(e) => setQty({ ...qty, [p.id]: e.target.value })} aria-label={`Amount of ${p.name} (${p.unit})`} />
            <span className="small muted">{p.unit}</span>
            {p.status === "draft" && canEdit && <button className="btn btn-pink btn-sm" onClick={() => act(p.id, "send")}>Approve & email</button>}
            {p.status === "sent" && <button className="btn btn-pink btn-sm" onClick={() => act(p.id, "receive")}>Received ✓</button>}
            {canEdit && <button className="btn btn-ghost btn-sm" onClick={() => act(p.id, "dismiss")}>Dismiss</button>}
          </div>
        </div>
      ))}
      {showSuppliers && (
        <div className="rota-wrap">
          <table className="rota" style={{ minWidth: 640 }}>
            <thead><tr><th scope="col">Ingredient</th><th scope="col">Supplier</th><th scope="col">Email</th><th scope="col">Order this much</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {ingredients.map((i) => {
                const e = edit[i.id] ?? { supplier_name: i.supplier_name ?? "", supplier_email: i.supplier_email ?? "", reorder_qty: i.reorder_qty ? String(i.reorder_qty) : "" };
                const set = (patch: Partial<typeof e>) => setEdit({ ...edit, [i.id]: { ...e, ...patch } });
                return (
                  <tr key={i.id}>
                    <th scope="row">{i.name}</th>
                    <td><input className="input" value={e.supplier_name} maxLength={60} onChange={(x) => set({ supplier_name: x.target.value })} aria-label={`${i.name} supplier name`} /></td>
                    <td><input className="input" type="email" value={e.supplier_email} onChange={(x) => set({ supplier_email: x.target.value })} aria-label={`${i.name} supplier email`} /></td>
                    <td><input className="input" style={{ width: "6rem" }} type="number" min={1} value={e.reorder_qty} placeholder={String(i.low_at * 4)} onChange={(x) => set({ reorder_qty: x.target.value })} aria-label={`${i.name} reorder amount`} /> <span className="small muted">{i.unit}</span></td>
                    <td className="row" style={{ gap: "0.3rem" }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => saveSupplier(i)}>Save</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => startOrder(i)} title="Draft an order now">Order now</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
