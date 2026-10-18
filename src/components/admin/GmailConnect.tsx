"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";

type S = { configured: boolean; address: string | null; provider: string | null; redirectUri: string };

/** Owner: connect the café Gmail so guests get emails from Moss & Moon */
export default function GmailConnect() {
  const { toast } = useStore();
  const [s, setS] = useState<S | null>(null);
  const load = () => fetch("/api/admin/gmail").then((r) => r.json()).then(setS).catch(() => {});
  useEffect(() => {
    load();
    // Coming back from Google
    const q = new URLSearchParams(window.location.search).get("gmail");
    if (q) {
      toast(q.startsWith("connected:") ? `Gmail connected ✓ Emails now come from ${q.slice(10)}` : q);
      window.history.replaceState(null, "", "/admin");
    }
  }, [toast]);
  if (!s) return null;
  return (
    <section className="card" style={{ padding: "1.2rem 1.3rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <div className="sum-row" style={{ alignItems: "center" }}>
        <h3 style={{ fontSize: "1.3rem" }}>✉️ Guest emails</h3>
        <span className={`status-tag ${s.address ? "promo-live" : ""}`}>{s.address ? "connected" : "not connected"}</span>
      </div>
      {s.address ? (
        <>
          <p className="small">Guests get their emails from <b>Moss &amp; Moon</b> &lt;{s.address}&gt;, sent through Gmail.</p>
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={async () => { await fetch("/api/admin/gmail", { method: "DELETE" }); toast("Disconnected"); load(); }}>Disconnect</button>
        </>
      ) : s.configured ? (
        <>
          <p className="small muted">Connect the café&apos;s Gmail so order, booking and ticket emails reach any guest, from “Moss &amp; Moon”.</p>
          <a className="btn btn-pink btn-sm" style={{ alignSelf: "flex-start" }} href="/api/admin/gmail/connect">Connect Gmail</a>
          <p className="tiny muted">Sign in with the café Gmail. Google may say the app isn&apos;t verified: tap <b>Advanced → Go to Moss &amp; Moon</b>, then <b>Continue</b>.</p>
        </>
      ) : (
        <p className="small muted">To send guest emails from the café Gmail, add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in Railway (DEPLOY.md, step 4). The redirect address to give Google is <code>{s.redirectUri}</code>.</p>
      )}
    </section>
  );
}
