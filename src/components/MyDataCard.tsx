"use client";
import { useState } from "react";
import Link from "next/link";
import { useStore } from "./Store";

/** Account page: download your data, or delete your account */
export default function MyDataCard({ onDeleted }: { onDeleted: () => void }) {
  const { toast, me } = useStore();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  async function remove() {
    setBusy(true);
    const r = await fetch("/api/account/data", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm }) });
    setBusy(false);
    if (!r.ok) return toast((await r.json()).error);
    toast("Your account is deleted. Take care ✿");
    onDeleted();
  }
  return (
    <div className="card account-card" style={{ marginTop: "1.2rem" }}>
      <h3>🔒 Your data</h3>
      <p className="small muted">See everything we keep about you, or delete it. More in our <Link href="/privacy">privacy notice</Link>.</p>
      <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
        <a className="btn btn-ghost btn-sm" href="/api/account/data" download>⬇ Download my data</a>
        {!open && <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>Delete my account</button>}
      </div>
      {open && (
        <div className="diet-warn" style={{ marginTop: "0.8rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <b>Delete your account?</b>
          <span className="small">This removes your account, favourites, stamps, regular orders, subscriptions and chats. Past orders stay in our books for tax, but without your name or contact details.{me?.credit ? ` Your ${"₹" + me.credit} credit will be lost.` : ""} This can&apos;t be undone.</span>
          <label className="field small">Type DELETE to confirm<input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></label>
          <div className="row"><button className="btn btn-pink btn-sm" disabled={busy || confirm !== "DELETE"} onClick={remove}>Delete everything</button><button className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); setConfirm(""); }}>Keep my account</button></div>
        </div>
      )}
    </div>
  );
}
