"use client";
import { useCallback, useEffect, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { useStore } from "../Store";

type P = { slug: string; title: string; body: string; cover: string | null; status: "draft" | "published"; published_at: string | null; updated_at: string };
const blank = { slug: "", title: "", body: "", cover: "", status: "draft" as const };
const post = (url: string, body: unknown, method = "POST") => fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** Owner: write and publish journal posts */
export default function JournalTab() {
  const { toast } = useStore();
  const [list, setList] = useState<P[] | null>(null);
  const [f, setF] = useState<{ slug: string; title: string; body: string; cover: string; status: "draft" | "published" } | null>(null);
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => fetch("/api/admin/posts").then((r) => r.json()).then(setList).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  async function save(status: "draft" | "published") {
    if (!f) return;
    const r = await post("/api/admin/posts", { ...f, status, slug: f.slug || undefined });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    toast(status === "published" ? "Published ✿ It's on the journal now." : "Draft saved");
    setF({ slug: d.slug, title: d.title, body: d.body, cover: d.cover ?? "", status: d.status });
    load();
  }
  async function draft() {
    setBusy(true);
    const r = await post("/api/admin/posts/draft", { idea });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return toast(d.error);
    setF({ ...(f ?? blank), title: d.title, body: d.body });
  }
  async function upload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setF((x) => (x ? { ...x, cover: d.url } : x));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
      {!f ? (
        <div className="row">
          <button className="btn btn-pink btn-sm" onClick={() => setF({ ...blank })}>+ New post</button>
          <a className="btn btn-ghost btn-sm" href="/journal" target="_blank" rel="noreferrer">View the journal ↗</a>
        </div>
      ) : (
        <section className="card newsletter-editor">
          <div className="row" style={{ alignItems: "end" }}>
            <label className="field" style={{ flex: 1, minWidth: 220 }}>Idea (for an AI draft)<input className="input" value={idea} maxLength={300} onChange={(e) => setIdea(e.target.value)} placeholder="Why our chai has rose petals" /></label>
            <button className="btn btn-ghost btn-sm" onClick={draft} disabled={busy}>{busy ? "Writing…" : "✨ Write a draft"}</button>
          </div>
          <label className="field">Title<input className="input" maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <div className="row" style={{ alignItems: "end" }}>
            <label className="field" style={{ flex: 1 }}>Cover photo: Unsplash link or upload<input className="input" value={f.cover} onChange={(e) => setF({ ...f, cover: e.target.value })} placeholder="https://images.unsplash.com/photo-…" /></label>
            <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>Upload<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
          </div>
          <div className="newsletter-split">
            <label className="field">Post
              <textarea className="input" rows={16} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
              <span className="tiny muted">## heading · **bold** · *italic* · [link](/#menu) · - list · blank line = new paragraph</span>
            </label>
            <div className="newsletter-preview post-body" style={{ fontSize: "0.95rem" }}>
              <h3>{f.title || "Your title"}</h3>
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(f.body || "Your post appears here.") }} />
            </div>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="row">
              <button className="btn btn-pink btn-sm" onClick={() => save("published")}>{f.status === "published" ? "Update" : "Publish"}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => save("draft")}>{f.status === "published" ? "Unpublish (back to draft)" : "Save draft"}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setF(null)}>Close</button>
            </span>
            {f.slug && <button className="btn btn-ghost btn-sm" onClick={async () => { await post("/api/admin/posts", { slug: f.slug }, "DELETE"); setF(null); load(); toast("Deleted"); }}>Delete</button>}
          </div>
        </section>
      )}
      <ul className="backup-list">
        {list?.map((p) => (
          <li key={p.slug}>
            <span><b>{p.title}</b> <span className={`status-tag ${p.status === "published" ? "promo-live" : ""}`}>{p.status}</span></span>
            <span className="small muted">{(p.published_at ?? p.updated_at).slice(0, 10)}</span>
            <button className="link-btn" onClick={() => setF({ slug: p.slug, title: p.title, body: p.body, cover: p.cover ?? "", status: p.status })}>Edit</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
