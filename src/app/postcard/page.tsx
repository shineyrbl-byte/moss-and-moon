"use client";
import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/components/Store";
import Postcard, { DESIGN_INFO, type Design } from "@/components/Postcard";

export default function NewPostcard() {
  const { toast } = useStore();
  const [f, setF] = useState({ design: "rose" as Design, to: "", from: "", message: "", gift: "" });
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const r = await fetch("/api/postcards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(d.error ?? "That didn't send.");
    setCode(d.code);
  }
  const link = code ? `${location.origin}/p/${code}` : "";
  async function share() {
    try { if (navigator.share) return await navigator.share({ title: `A postcard for ${f.to}`, text: `${f.from} sent you a postcard from Moss & Moon 💌`, url: link }); } catch { return; }
    try { await navigator.clipboard.writeText(link); toast("Link copied ✿"); } catch {}
  }
  return (
    <div className="page narrow">
      <p className="eyebrow">wish you were here</p>
      <h1 className="h2">Send a <em>postcard</em></h1>
      <p className="lead">Pick a picture, write a note and share the link. Want to treat them too? <Link href="/gift-a-drink" className="link-btn">Gift a drink</Link> first, then add its code below.</p>
      <div style={{ margin: "1.2rem 0" }}><Postcard c={{ design: f.design, to: f.to || "friend", from: f.from || "me", message: f.message || "Your note will go here ✿" }} /></div>
      {code ? (
        <div className="reward-banner" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <b>💌 Your postcard is ready!</b>
          <code className="tiny" style={{ wordBreak: "break-all" }}>{link}</code>
          <span className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
            <button className="btn btn-pink btn-sm" onClick={share}>Share it</button>
            <a className="btn btn-ghost btn-sm" href={`https://wa.me/?text=${encodeURIComponent(`${f.from} sent you a postcard from Moss & Moon 💌 ${link}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
            <button className="btn btn-ghost btn-sm" onClick={() => { setCode(null); setF({ ...f, message: "", gift: "" }); }}>Write another</button>
          </span>
        </div>
      ) : (
        <form className="card booking" onSubmit={send} style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
          <div className="chips" role="radiogroup" aria-label="Design" style={{ justifyContent: "flex-start" }}>
            {(Object.keys(DESIGN_INFO) as Design[]).map((d) => <button key={d} type="button" role="radio" aria-checked={f.design === d} className={`chip ${f.design === d ? "on" : ""}`} onClick={() => setF({ ...f, design: d })}>{DESIGN_INFO[d].art} {DESIGN_INFO[d].label}</button>)}
          </div>
          <div className="row">
            <label className="field">To<input className="input" required maxLength={30} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
            <label className="field">From<input className="input" required maxLength={30} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
          </div>
          <label className="field">Your note<textarea className="input" required minLength={3} maxLength={280} rows={4} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="Saved you the window seat. Come for a cold brew soon?" /></label>
          <label className="field">Gifted drink code or link <span className="muted small">· optional</span><input className="input" value={f.gift} onChange={(e) => setF({ ...f, gift: e.target.value })} placeholder="From your “gift a drink” page" /></label>
          {error && <p className="error small">{error}</p>}
          <button className="btn btn-pink" disabled={busy}>{busy ? "Writing…" : "💌 Make my postcard"}</button>
        </form>
      )}
    </div>
  );
}
