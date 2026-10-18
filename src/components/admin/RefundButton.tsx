"use client";
import { useState } from "react";
import { rupees } from "@/lib/pricing";
import { useStore } from "../Store";

/** Owner: refund all or part of an order paid online */
export default function RefundButton({ code, refundable, onDone }: { code: string; refundable: number; onDone: () => void }) {
  const { toast } = useStore();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(refundable));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (refundable <= 0) return null;
  if (!open) return <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>↩ Refund</button>;

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch(`/api/orders/${code}/refund`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: Number(amount), reason }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return toast(d.error);
    toast(`Refunded ${rupees(d.refunded)} ✓`);
    setOpen(false);
    onDone();
  }

  return (
    <form className="refund-form" onSubmit={go}>
      <label className="small">Amount (up to {rupees(refundable)})
        <input className="input" type="number" min={1} max={refundable} required value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <input className="input" placeholder="Reason (optional, goes in their email)" maxLength={120} value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="row">
        <button className="btn btn-pink btn-sm" disabled={busy}>{busy ? "Refunding…" : `Refund ${rupees(Number(amount) || 0)}`}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
