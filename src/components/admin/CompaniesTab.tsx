"use client";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "../Store";
import { rupees } from "@/lib/pricing";

type C = { id: number; name: string; billing_email: string; gstin: string | null; join_code: string; monthly_limit: number | null; active: number; members: { id: number; name: string | null; email: string }[]; orders: number; total: number; invoice: { amount: number; orders: number; sent_at: string; paid_at: string | null } | null; unpaid: { month: string; amount: number }[] };
const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const label = (m: string) => new Date(m + "-01T12:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const shift = (m: string, by: number) => { const d = new Date(m + "-01T12:00"); d.setMonth(d.getMonth() + by); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

/** Owner: offices with a tab, this month's spend, and the monthly invoice */
export default function CompaniesTab() {
  const { toast } = useStore();
  const [month, setMonth] = useState("");
  const [d, setD] = useState<{ month: string; companies: C[] } | null>(null);
  const [f, setF] = useState({ name: "", billingEmail: "", gstin: "", monthlyLimit: "" });
  const [busy, setBusy] = useState<number | null>(null);
  const load = useCallback(() => fetch(`/api/admin/companies${month ? `?month=${month}` : ""}`).then((r) => r.json()).then((x) => { setD(x); setMonth(x.month); }).catch(() => {}), [month]);
  useEffect(() => { load(); }, [load]);
  if (!d) return <p className="muted">Loading…</p>;
  async function act(c: C, body: object, msg: string) {
    setBusy(c.id);
    const r = await fetch("/api/admin/companies", json("PATCH", { id: c.id, month: d!.month, ...body }));
    const x = await r.json();
    setBusy(null);
    if (!r.ok) return toast(x.error);
    toast(msg);
    load();
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/companies", json("POST", f));
    const x = await r.json();
    if (!r.ok) return toast(x.error);
    setF({ name: "", billingEmail: "", gstin: "", monthlyLimit: "" });
    toast("Company added. Share its code with the office ✿");
    load();
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div className="row" style={{ alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setMonth(shift(d.month, -1))} aria-label="Previous month">←</button>
        <b>{label(d.month)}</b>
        <button className="btn btn-ghost btn-sm" onClick={() => setMonth(shift(d.month, 1))} aria-label="Next month">→</button>
      </div>
      {d.companies.map((c) => (
        <section key={c.id} className="card" style={{ padding: "1rem 1.2rem", opacity: c.active ? 1 : 0.55 }}>
          <div className="sum-row" style={{ alignItems: "baseline", flexWrap: "wrap", gap: "0.4rem" }}>
            <h3 style={{ fontSize: "1.2rem" }}>🏢 {c.name}</h3>
            <span>{c.orders} orders · <b>{rupees(c.total)}</b></span>
          </div>
          <p className="small">Join code <b style={{ fontFamily: "monospace" }}>{c.join_code}</b> · invoices to {c.billing_email}{c.gstin ? ` · GSTIN ${c.gstin}` : ""}{c.monthly_limit ? ` · ${rupees(c.monthly_limit)} a month each` : ""}</p>
          <p className="small muted">{c.members.length ? `Members: ${c.members.map((m) => m.name || m.email).join(", ")}` : "No members yet. Staff join from their account page with the code."}</p>
          {c.unpaid.length > 0 && <p className="small cashup-bad">Unpaid: {c.unpaid.map((u) => `${label(u.month)} ${rupees(Math.round(u.amount))}`).join(", ")}</p>}
          <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
            <button className="btn btn-pink btn-sm" disabled={busy === c.id || !c.orders} onClick={() => act(c, { action: "invoice" }, `Invoice sent to ${c.billing_email}`)}>{c.invoice ? "Send the invoice again" : `Send ${label(d.month)} invoice`}</button>
            {c.invoice && !c.invoice.paid_at && <button className="btn btn-ghost btn-sm" onClick={() => act(c, { action: "paid" }, "Marked paid ✓")}>Mark paid</button>}
            {c.invoice?.paid_at && <span className="success small">✓ Paid {c.invoice.paid_at.slice(0, 10)}</span>}
            {c.members.map((m) => <button key={m.id} className="link-btn small" onClick={() => act(c, { action: "removeMember", customerId: m.id }, "Removed")}>Remove {m.name || m.email}</button>)}
            <button className="link-btn small" onClick={() => act(c, { action: "toggle" }, c.active ? "Tab paused" : "Tab open again")}>{c.active ? "Pause tab" : "Reopen tab"}</button>
          </div>
        </section>
      ))}
      <form className="card" style={{ padding: "1rem 1.2rem" }} onSubmit={add}>
        <h3 style={{ fontSize: "1.1rem" }}>Add a company</h3>
        <div className="row">
          <label className="field">Name<input className="input" required maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="field">Invoice email<input className="input" type="email" required value={f.billingEmail} onChange={(e) => setF({ ...f, billingEmail: e.target.value })} /></label>
        </div>
        <div className="row">
          <label className="field">GSTIN <span className="muted small">· optional</span><input className="input" maxLength={15} value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} /></label>
          <label className="field">Limit a month per person <span className="muted small">· optional</span><input className="input" inputMode="numeric" value={f.monthlyLimit} onChange={(e) => setF({ ...f, monthlyLimit: e.target.value.replace(/\D/g, "") })} /></label>
        </div>
        <button className="btn btn-pink btn-sm">Add company</button>
      </form>
    </div>
  );
}
