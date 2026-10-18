"use client";
import { useCallback, useEffect, useState } from "react";
import { rupees } from "@/lib/pricing";
import { useStore } from "../Store";

type P = {
  code: string; kind: "percent" | "amount"; value: number; min_order: number; max_uses: number | null; uses: number; once_per_guest: number;
  starts: string | null; expires: string | null; active: number; note: string | null; label: string; discountGiven: number;
};
const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const blank = { code: "", kind: "percent", value: "10", minOrder: "", maxUses: "", oncePerGuest: false, starts: "", expires: "", note: "" };

/** Owner: create and manage promo codes */
export default function PromosTab() {
  const { toast } = useStore();
  const [list, setList] = useState<P[] | null>(null);
  const [f, setF] = useState(blank);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => fetch("/api/admin/promos").then((r) => r.json()).then(setList).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/promos", json("POST", { ...f, value: Number(f.value), minOrder: Number(f.minOrder) || 0, maxUses: f.maxUses === "" ? null : Number(f.maxUses) }));
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    toast(`${d.code} is live ✿`);
    setF(blank);
    setOpen(false);
    load();
  }
  async function act(code: string, method: "PATCH" | "DELETE", body: object = {}) {
    const r = await fetch("/api/admin/promos", json(method, { code, ...body }));
    if (!r.ok) toast((await r.json()).error);
    load();
  }

  const status = (p: P) => {
    const today = new Date().toISOString().slice(0, 10);
    if (!p.active) return "off";
    if (p.expires && today > p.expires) return "expired";
    if (p.starts && today < p.starts) return "scheduled";
    if (p.max_uses !== null && p.uses >= p.max_uses) return "used up";
    return "live";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <p className="small muted">Guests type these at checkout. Prices are always checked again on the server.</p>
        <button className="btn btn-pink btn-sm" onClick={() => setOpen((o) => !o)}>{open ? "Close" : "+ New code"}</button>
      </div>
      {open && (
        <form className="card promo-form" onSubmit={create}>
          <div className="row">
            <label className="field">Code<input className="input" required maxLength={20} placeholder="SUMMER20" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} /></label>
            <label className="field">Discount
              <span className="row" style={{ gap: "0.4rem", flexWrap: "nowrap" }}>
                <select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} aria-label="Discount type">
                  <option value="percent">% off</option>
                  <option value="amount">₹ off</option>
                </select>
                <input className="input" type="number" required min={1} max={f.kind === "percent" ? 90 : 5000} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} aria-label="Discount amount" />
              </span>
            </label>
            <label className="field">Minimum order (₹)<input className="input" type="number" min={0} placeholder="none" value={f.minOrder} onChange={(e) => setF({ ...f, minOrder: e.target.value })} /></label>
          </div>
          <div className="row">
            <label className="field">Starts<input className="input" type="date" value={f.starts} onChange={(e) => setF({ ...f, starts: e.target.value })} /></label>
            <label className="field">Ends<input className="input" type="date" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} /></label>
            <label className="field">Max uses<input className="input" type="number" min={1} placeholder="no limit" value={f.maxUses} onChange={(e) => setF({ ...f, maxUses: e.target.value })} /></label>
          </div>
          <label className="row small" style={{ alignItems: "center", gap: "0.5rem" }}>
            <input type="checkbox" checked={f.oncePerGuest} onChange={(e) => setF({ ...f, oncePerGuest: e.target.checked })} /> Once per guest (by phone number)
          </label>
          <label className="field">Note for you (optional)<input className="input" maxLength={80} placeholder="e.g. Instagram giveaway" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
          <button className="btn btn-pink btn-sm" style={{ alignSelf: "flex-start" }}>Create code</button>
        </form>
      )}
      {list?.map((p) => {
        const st = status(p);
        return (
          <div key={p.code} className="card promo-row">
            <div>
              <strong className="code">{p.code}</strong> <span className={`status-tag promo-${st.replace(" ", "-")}`}>{st}</span>
              <p className="small">{p.label}{p.once_per_guest ? " · once per guest" : ""}</p>
              <p className="small muted">
                Used {p.uses}{p.max_uses !== null ? ` of ${p.max_uses}` : ""} times · {rupees(p.discountGiven)} given
                {p.starts || p.expires ? ` · ${p.starts ?? "now"} → ${p.expires ?? "no end"}` : ""}
                {p.note ? ` · ${p.note}` : ""}
              </p>
            </div>
            <div className="row" style={{ gap: "0.4rem" }}>
              <button className="btn btn-ghost btn-sm" onClick={() => act(p.code, "PATCH", { active: !p.active })}>{p.active ? "Turn off" : "Turn on"}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => act(p.code, "DELETE")} aria-label={`Delete ${p.code}`}>Delete</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
