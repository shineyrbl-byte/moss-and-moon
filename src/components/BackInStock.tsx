"use client";
import { useState } from "react";
import { useStore } from "./Store";

/** On a sold-out item: "tell me when it's back" */
export default function BackInStock({ itemId, name, email: start }: { itemId: string; name: string; email: string }) {
  const { toast } = useStore();
  const [email, setEmail] = useState(start);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (done) return <p className="reward-banner small">✓ We&apos;ll email {email} when {name} is back.</p>;
  return (
    <form className="back-in-stock" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      const r = await fetch("/api/stock-alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, email }) });
      setBusy(false);
      if (!r.ok) return toast((await r.json()).error);
      setDone(true);
    }}>
      <span className="small">😢 Sold out right now. Want an email when it&apos;s back?</span>
      <div className="row">
        <input className="input" type="email" required placeholder="you@example.com" aria-label="Your email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn btn-ghost btn-sm" disabled={busy}>Tell me</button>
      </div>
    </form>
  );
}
