"use client";
import { useState } from "react";
import { useStore } from "../Store";

/** Owner, Settings: wipe test orders and fill the café with a month of realistic sample data */
export default function DemoResetCard() {
  const { toast } = useStore();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    const r = await fetch("/api/admin/demo-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return toast(d.error);
    toast(`Done: ${d.orders} sample orders. Backup saved as ${d.backup}`);
    setOpen(false);
    setConfirm("");
    setTimeout(() => location.reload(), 1200);
  }
  return (
    <section className="card" style={{ padding: "1.1rem 1.2rem" }}>
      <h3 style={{ fontSize: "1.2rem" }}>🎬 Demo reset</h3>
      <p className="small muted">For showing the site to people: clears orders, bookings, reviews, stamps, cash-ups and other activity, then fills in a month of believable sample orders, reviews and bookings so the charts look alive. Your menu, settings, staff logins, guest accounts and events stay. A backup is made first, so you can restore it from Backups.</p>
      {!open ? <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>Reset with sample data…</button> : (
        <div className="diet-warn" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <b>This clears all real orders and bookings.</b>
          <span className="small">Only do this on a demo site, not while the café is trading.</span>
          <label className="field small">Type RESET to confirm<input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></label>
          <div className="row"><button className="btn btn-pink btn-sm" disabled={busy || confirm !== "RESET"} onClick={run}>{busy ? "Working…" : "Reset now"}</button><button className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); setConfirm(""); }}>Cancel</button></div>
        </div>
      )}
    </section>
  );
}
