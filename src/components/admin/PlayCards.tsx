"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";

/** Notices tab: story chain lines waiting for a read */
export function StoryChainCard() {
  const [lines, setLines] = useState<{ id: number; text: string; name: string }[] | null>(null);
  const [story, setStory] = useState<{ opener: string; lines: { text: string }[] } | null>(null);
  const load = () => {
    fetch("/api/story-chain?all=1").then((r) => (r.ok ? r.json() : null)).then((d) => d && setLines(d.lines)).catch(() => {});
    fetch("/api/story-chain").then((r) => r.json()).then((d) => setStory(d.story)).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  if (!lines || !story) return null;
  async function review(id: number, approve: boolean) {
    await fetch("/api/story-chain", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, approve }) });
    load();
  }
  const last = story.lines.at(-1)?.text ?? story.opener;
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "1.1rem" }}>📜 Story chain · line {story.lines.length + 1} of 20 {lines.length > 0 && <span className="branch-tag">{lines.length} to read</span>}</h3>
      <p className="small muted" style={{ margin: 0 }}>So far it ends: &ldquo;{last}&rdquo; · <a href="/story-chain" target="_blank" rel="noreferrer">/story-chain</a>. Lines are added in the order you approve them, so pick the one that follows best.</p>
      {lines.length > 0 && (
        <ul className="check-list">
          {lines.map((l) => (
            <li key={l.id}>
              <span style={{ flex: 1 }} className="small">&ldquo;{l.text}&rdquo;<span className="muted"> · {l.name || "anonymous"}</span></span>
              <span className="row" style={{ gap: "0.3rem" }}><button className="chip on" onClick={() => review(l.id, true)}>Add it</button><button className="chip" onClick={() => review(l.id, false)}>Remove</button></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Notices tab (owner): the guests vs barista game */
export function Connect4Card() {
  const { toast } = useStore();
  const [s, setS] = useState<{ game: number; status: string; moves: number; score: { guests: number; barista: number; draws: number } } | null>(null);
  useEffect(() => { fetch("/api/connect4").then((r) => r.json()).then(setS).catch(() => {}); }, []);
  if (!s) return null;
  async function reset() {
    const r = await fetch("/api/connect4", { method: "DELETE" });
    if (!r.ok) return toast("Only the owner can do that.");
    setS(await r.json()); toast("Fresh board ✓");
  }
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
      <div className="sum-row" style={{ alignItems: "center" }}>
        <h3 style={{ fontSize: "1.1rem" }}>🔴 Guests vs the barista · game {s.game}</h3>
        <button className="link-btn small" onClick={reset}>Start a new game</button>
      </div>
      <p className="small muted" style={{ margin: 0 }}>{s.status === "playing" ? `${s.moves} rounds played` : "Finished; a new one starts soon"} · score {s.score.guests}–{s.score.barista}{s.score.draws ? `, ${s.score.draws} drawn` : ""} · <a href="/connect-four" target="_blank" rel="noreferrer">/connect-four</a>. Each round closes 20 minutes after its first vote.</p>
    </section>
  );
}

type Art = { id: number; title: string; medium: string; size: string; price: number | null; img: string; sold: number };
/** Events tab (owner): the artist of the month and the pieces on the walls */
export function ArtCard() {
  const { toast } = useStore();
  const [d, setD] = useState<{ artist: { name: string; bio: string; link: string } | null; works: Art[] } | null>(null);
  const [a, setA] = useState({ name: "", bio: "", link: "" });
  const [f, setF] = useState({ title: "", medium: "", size: "", price: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => fetch("/api/art").then((r) => r.json()).then((x) => { setD(x); setA(x.artist ?? { name: "", bio: "", link: "" }); }).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!d) return null;
  async function saveArtist(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/art", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ artist: a }) });
    if (!r.ok) return toast("That didn't save.");
    load(); toast("Artist saved ✓");
  }
  async function addPiece(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast("Choose a photo of the piece.");
    setBusy(true);
    const form = new FormData();
    Object.entries(f).forEach(([k, v]) => form.set(k, v));
    form.set("file", file);
    const r = await fetch("/api/art", { method: "POST", body: form });
    const x = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast(x.error ?? "That didn't upload.");
    setF({ title: "", medium: "", size: "", price: "" }); setFile(null); (e.target as HTMLFormElement).reset(); load(); toast("On the wall ✓");
  }
  const sold = async (id: number, v: boolean) => { await fetch("/api/art", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, sold: v }) }); load(); };
  const remove = async (id: number) => { await fetch(`/api/art?id=${id}`, { method: "DELETE" }); load(); };
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginTop: "1rem" }}>
      <h3 style={{ fontSize: "1.1rem" }}>🖼 Artist wall · {d.works.length} piece{d.works.length === 1 ? "" : "s"}</h3>
      <p className="small muted" style={{ margin: 0 }}>Shown at <a href="/artist-wall" target="_blank" rel="noreferrer">/artist-wall</a>. Prices say &ldquo;ask at the counter&rdquo;; nothing is sold online.</p>
      <form onSubmit={saveArtist} style={{ display: "grid", gap: "0.4rem", marginTop: "0.6rem" }}>
        <label className="field small">Artist of the month<input className="input" maxLength={60} value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} placeholder="Leave empty to hide" /></label>
        <label className="field small">About them<textarea className="input" rows={3} maxLength={500} value={a.bio} onChange={(e) => setA({ ...a, bio: e.target.value })} /></label>
        <label className="field small">Link to their work <span className="muted">· optional, https://</span><input className="input" maxLength={200} value={a.link} onChange={(e) => setA({ ...a, link: e.target.value })} /></label>
        <span><button className="btn btn-ghost btn-sm">Save artist</button></span>
      </form>
      <form onSubmit={addPiece} className="row" style={{ alignItems: "end", flexWrap: "wrap", marginTop: "0.6rem" }}>
        <label className="field small" style={{ maxWidth: "12rem" }}>Title<input className="input" maxLength={80} required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className="field small" style={{ maxWidth: "10rem" }}>Medium<input className="input" maxLength={60} value={f.medium} onChange={(e) => setF({ ...f, medium: e.target.value })} placeholder="Watercolour" /></label>
        <label className="field small" style={{ maxWidth: "8rem" }}>Size<input className="input" maxLength={40} value={f.size} onChange={(e) => setF({ ...f, size: e.target.value })} placeholder="A3" /></label>
        <label className="field small" style={{ maxWidth: "8rem" }}>Price ₹<input className="input" type="number" min={0} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="Not for sale" /></label>
        <label className="field small" style={{ maxWidth: "14rem" }}>Photo<input className="input" type="file" accept="image/jpeg,image/png,image/webp" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} disabled={busy}>{busy ? "Uploading…" : "Add piece"}</button>
      </form>
      {d.works.length > 0 && (
        <ul className="check-list">
          {d.works.map((w) => (
            <li key={w.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={w.img} alt="" className="latte-thumb" />
              <span style={{ flex: 1 }} className="small"><b>{w.title}</b><span className="muted"> · {[w.medium, w.size, w.price ? `₹${w.price}` : ""].filter(Boolean).join(" · ")}</span></span>
              <span className="row" style={{ gap: "0.3rem" }}><button className={`chip ${w.sold ? "on" : ""}`} onClick={() => sold(w.id, !w.sold)}>{w.sold ? "Sold ✓" : "Mark sold"}</button><button className="chip" onClick={() => remove(w.id)}>Remove</button></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
