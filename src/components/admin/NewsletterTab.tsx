"use client";
import { useCallback, useEffect, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { useStore } from "../Store";

type N = { id: number; subject: string; body: string; status: string; recipients: number; sent_count: number; failed_count: number; created_at: string; sent_at: string | null };
const json = (body: unknown, method = "POST") => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** Owner: write the Pink Post, test it, and send it to subscribers */
export default function NewsletterTab() {
  const { toast } = useStore();
  const [d, setD] = useState<{ newsletters: N[]; subscribers: number; unsubscribed: number } | null>(null);
  const [f, setF] = useState<{ id?: number; subject: string; body: string }>({ subject: "", body: "" });
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(() => fetch("/api/admin/newsletter").then((r) => r.json()).then(setD).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!d?.newsletters.some((n) => n.status === "sending")) return;
    const t = setInterval(load, 4000); // watch it go out
    return () => clearInterval(t);
  }, [d, load]);

  async function save() {
    const r = await fetch("/api/admin/newsletter", json(f));
    const x = await r.json();
    if (!r.ok) { toast(x.error); return null; }
    setF((v) => ({ ...v, id: x.id }));
    load();
    return x.id as number;
  }
  async function writeDraft() {
    setBusy("draft");
    const r = await fetch("/api/admin/newsletter/draft", json({ idea }));
    const x = await r.json();
    setBusy("");
    if (!r.ok) return toast(x.error);
    setF({ ...f, subject: x.subject, body: x.body });
    toast(x.by === "simple" ? "Here's a starting point ✿" : "Draft written ✿ Have a read and make it yours.");
  }
  async function send(test: boolean) {
    const id = f.id ?? (await save());
    if (!id) return;
    if (f.id) await save();
    setBusy(test ? "test" : "send");
    const r = await fetch("/api/admin/newsletter/send", json({ id, test }));
    const x = await r.json();
    setBusy("");
    setConfirm(false);
    if (!r.ok) return toast(x.error);
    toast(test ? `Test sent to ${x.to} ✓` : `Sending to ${x.recipients} subscribers ✿`);
    if (!test) setF({ subject: "", body: "" });
    load();
  }

  if (!d) return <p className="muted">Loading…</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
      <div className="mode-banner">
        <span>💌 <b>{d.subscribers}</b> subscriber{d.subscribers === 1 ? "" : "s"}{d.unsubscribed ? ` · ${d.unsubscribed} unsubscribed` : ""}</span>
        <span className="small">Everyone gets a one-click unsubscribe link.</span>
      </div>
      <section className="card newsletter-editor">
        <div className="row" style={{ alignItems: "end" }}>
          <label className="field" style={{ flex: 1, minWidth: 220 }}>What&apos;s it about? (for the AI draft)
            <input className="input" value={idea} maxLength={300} onChange={(e) => setIdea(e.target.value)} placeholder="Diwali specials, the new frappé, latte art class next week" />
          </label>
          <button className="btn btn-ghost btn-sm" onClick={writeDraft} disabled={busy === "draft"}>{busy === "draft" ? "Writing…" : "✨ Write a draft"}</button>
        </div>
        <label className="field">Subject<input className="input" maxLength={120} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></label>
        <div className="newsletter-split">
          <label className="field">Message
            <textarea className="input" rows={14} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder={"Hello lovely ✿\n\n## New on the menu\n- **Cookies & Cream Frappé**\n\n[Order ahead](https://…)"} />
            <span className="tiny muted">## heading · **bold** · *italic* · [link](https://…) · - list · blank line = new paragraph</span>
          </label>
          <div className="newsletter-preview" aria-label="Preview">
            <b className="small muted">Preview</b>
            <h3>{f.subject || "Your subject"}</h3>
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(f.body || "Your message appears here.") }} />
          </div>
        </div>
        <div className="row">
          <button className="btn btn-ghost btn-sm" onClick={save}>Save draft</button>
          <button className="btn btn-ghost btn-sm" onClick={() => send(true)} disabled={busy === "test" || !f.subject}>{busy === "test" ? "Sending…" : "Send me a test"}</button>
          {!confirm ? (
            <button className="btn btn-pink btn-sm" onClick={() => setConfirm(true)} disabled={!f.subject || !d.subscribers}>Send to {d.subscribers} subscriber{d.subscribers === 1 ? "" : "s"}…</button>
          ) : (
            <span className="row" style={{ alignItems: "center" }}>
              <span className="small">Send to everyone now?</span>
              <button className="btn btn-pink btn-sm" onClick={() => send(false)} disabled={busy === "send"}>Yes, send it</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)}>Not yet</button>
            </span>
          )}
        </div>
      </section>
      <section>
        <h3 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>Past issues</h3>
        <ul className="backup-list">
          {d.newsletters.map((n) => (
            <li key={n.id}>
              <span><b>{n.subject}</b> <span className={`status-tag ${n.status === "sent" ? "promo-live" : ""}`}>{n.status}</span></span>
              <span className="small muted">{n.status === "draft" ? n.created_at.slice(0, 10) : `${n.sent_count}/${n.recipients} sent${n.failed_count ? ` · ${n.failed_count} failed` : ""}`}</span>
              {n.status === "draft" ? <button className="link-btn" onClick={() => setF({ id: n.id, subject: n.subject, body: n.body })}>Edit</button> : <span />}
            </li>
          ))}
          {!d.newsletters.length && <li className="muted"><span>Nothing sent yet.</span><span /><span /></li>}
        </ul>
      </section>
    </div>
  );
}
