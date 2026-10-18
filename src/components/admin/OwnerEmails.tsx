"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";

type S = { ownerEmail: string; dailySummary: boolean; errorAlerts: boolean; backupEmail: boolean };
const json = (method: string, body?: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

/** Owner: where the nightly summary, error alerts and backups are emailed */
export default function OwnerEmails() {
  const { toast } = useStore();
  const [s, setS] = useState<S | null>(null);
  const [email, setEmail] = useState("");
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings").then((r) => r.json()).then((d) => { setS(d); setEmail(d.ownerEmail ?? ""); }).catch(() => {});
  }, []);

  async function save(patch: Partial<S>) {
    const r = await fetch("/api/admin/settings", json("PATCH", patch));
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setS(d);
    return true;
  }

  if (!s) return null;
  const toggle = (key: "dailySummary" | "errorAlerts" | "backupEmail", label: string, hint: string) => (
    <div className="toggle-row">
      <span>{label} <span className="small muted">· {hint}</span></span>
      <button className={`switch ${s[key] ? "" : "off"}`} onClick={() => save({ [key]: !s[key] })} aria-pressed={s[key]} aria-label={label} />
    </div>
  );

  return (
    <section className="card" style={{ padding: "1.2rem 1.3rem", display: "flex", flexDirection: "column", gap: "0.7rem" }}>
      <h3 style={{ fontSize: "1.3rem" }}>📬 Emails for you</h3>
      <form className="row" onSubmit={async (e) => { e.preventDefault(); if (await save({ ownerEmail: email })) toast(email ? "Saved ✿" : "Owner emails turned off"); }}>
        <input className="input" style={{ flex: 1, minWidth: 200 }} type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Your email" />
        <button className="btn btn-sm">Save</button>
      </form>
      {!s.ownerEmail && <p className="small muted">Add your email to get these. (With Resend's free plan and no domain, use the address you signed up with.)</p>}
      {toggle("dailySummary", "Nightly summary", "sales, best sellers, reviews and low stock, 15 min after closing")}
      {toggle("errorAlerts", "Error alerts", "when something breaks on the site (at most one per problem per hour)")}
      {toggle("backupEmail", "Weekly backup", "a copy of the database every Sunday night")}
      <div className="row">
        <button className="btn btn-ghost btn-sm" onClick={() => fetch("/api/admin/summary").then((r) => r.json()).then(setPreview)}>👀 Preview today&apos;s summary</button>
        <button className="btn btn-ghost btn-sm" disabled={!s.ownerEmail} onClick={async () => {
          const r = await fetch("/api/admin/summary", json("POST"));
          toast(r.ok ? "Sent! Check your inbox ✿" : (await r.json()).error);
        }}>Send it now</button>
      </div>
      {preview && (
        <div className="summary-preview">
          <div className="sum-row"><b>{preview.subject}</b><button className="link-btn" onClick={() => setPreview(null)}>Close</button></div>
          <iframe title="Summary preview" sandbox="" srcDoc={`<body style="font-family:Helvetica,Arial,sans-serif;color:#3b2720;background:#fffaf6;padding:12px">${preview.html}</body>`} />
        </div>
      )}
    </section>
  );
}
