"use client";
import { useState } from "react";
import { useStore } from "./Store";
import { rupees } from "@/lib/pricing";

/** Account page: join your office's tab with its code */
export default function CompanyCard() {
  const { me, refreshMe, toast } = useStore();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  if (!me) return null;
  async function send(method: "POST" | "DELETE", msg: string) {
    setBusy(true);
    const r = await fetch("/api/account/company", { method, headers: { "Content-Type": "application/json" }, body: method === "POST" ? JSON.stringify({ code }) : undefined });
    setBusy(false);
    if (!r.ok) return toast((await r.json()).error);
    toast(msg);
    setCode("");
    refreshMe();
  }
  const c = me.company;
  return (
    <div className="card account-card" style={{ marginTop: "1.2rem" }}>
      <h3>🏢 Company tab</h3>
      {c ? (
        <>
          <p>You can put orders on the <b>{c.name}</b> tab at checkout. They get one invoice a month.</p>
          <p className="small muted">This month: {rupees(c.spent)}{c.limit ? ` of your ${rupees(c.limit)} limit` : ""}.</p>
          <button className="link-btn small" disabled={busy} onClick={() => send("DELETE", "Left the company tab")}>Leave this tab</button>
        </>
      ) : (
        <>
          <p className="small muted">Does your office have a Moss &amp; Moon tab? Enter the code they gave you and your orders can go on it.</p>
          <form className="row" onSubmit={(e) => { e.preventDefault(); send("POST", "You're on the company tab ✿"); }}>
            <input className="input" placeholder="CO-XXXXXX" aria-label="Company code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <button className="btn btn-ghost btn-sm" disabled={busy || code.length < 4}>Join</button>
          </form>
          <p className="tiny muted">Running an office? Ask us at the counter or by email and we&apos;ll set one up.</p>
        </>
      )}
    </div>
  );
}
