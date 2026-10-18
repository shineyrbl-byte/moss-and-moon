"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";

/** Owner: the Google review link (for the "post it on Google" nudge) and the café WhatsApp number */
export default function LinksCard() {
  const { toast } = useStore();
  const [l, setL] = useState<{ googleReview: string; whatsapp: string } | null>(null);
  const [saved, setSaved] = useState("");
  useEffect(() => { fetch("/api/admin/cafe-config").then((r) => r.json()).then((d) => { setL(d.links); setSaved(JSON.stringify(d.links)); }).catch(() => {}); }, []);
  if (!l) return null;
  async function save() {
    const r = await fetch("/api/admin/cafe-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ links: l }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setSaved(JSON.stringify(d.links));
    toast("Saved. Reload the site to see it ✿");
  }
  return (
    <section className="card" style={{ padding: "1.1rem 1.2rem", marginTop: "1.2rem" }}>
      <h3 style={{ fontSize: "1.2rem" }}>🔗 Google reviews &amp; WhatsApp</h3>
      <label className="field">Google review link <span className="muted small">· Google Business Profile → “Ask for reviews” → copy the link</span>
        <input className="input" placeholder="https://g.page/r/..." value={l.googleReview} onChange={(e) => setL({ ...l, googleReview: e.target.value })} />
      </label>
      <p className="tiny muted">Guests who give 4 or 5 stars on the site get a button to post the same review on Google (their words are copied for them).</p>
      <label className="field">WhatsApp number <span className="muted small">· 10 digits</span>
        <input className="input" inputMode="numeric" placeholder="98xxxxxxxx" value={l.whatsapp} onChange={(e) => setL({ ...l, whatsapp: e.target.value.replace(/\D/g, "").slice(0, 10) })} />
      </label>
      <p className="tiny muted">Adds a “Message us on WhatsApp” button to the chat and the footer. Free, using a normal wa.me link.</p>
      {JSON.stringify(l) !== saved && <button className="btn btn-pink btn-sm" onClick={save}>Save</button>}
    </section>
  );
}
