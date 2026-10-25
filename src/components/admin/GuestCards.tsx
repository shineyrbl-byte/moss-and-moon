"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";
import { PET_KINDS } from "@/lib/pets";

const nice = (d: string) => new Date(`${d}T12:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

/** Notices tab: shout-outs for the TV board */
export function ShoutoutsCard() {
  const [list, setList] = useState<{ id: number; date: string; text: string; from_name: string; status: string }[] | null>(null);
  const load = () => fetch("/api/shoutouts?all=1").then((r) => (r.ok ? r.json() : null)).then((d) => d && setList(d.shouts)).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!list) return null;
  const waiting = list.filter((s) => s.status === "pending"), coming = list.filter((s) => s.status === "approved");
  async function review(id: number, approve: boolean) {
    await fetch("/api/shoutouts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, approve }) });
    load();
  }
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "1.1rem" }}>🎂 Shout-outs {waiting.length > 0 && <span className="branch-tag">{waiting.length} to check</span>}</h3>
      <p className="small muted" style={{ margin: 0 }}>Guests ask at <a href="/shout-outs" target="_blank" rel="noreferrer">/shout-outs</a>. Approved ones show on the TV board all day on their date. {coming.length} coming up.</p>
      {list.length > 0 && (
        <ul className="check-list">
          {list.map((s) => (
            <li key={s.id}>
              <span style={{ flex: 1 }} className="small"><b>{nice(s.date)}</b> · &ldquo;{s.text}&rdquo;{s.from_name && <span className="muted"> · from {s.from_name}</span>}</span>
              {s.status === "pending"
                ? <span className="row" style={{ gap: "0.3rem" }}><button className="chip on" onClick={() => review(s.id, true)}>Approve</button><button className="chip" onClick={() => review(s.id, false)}>Remove</button></span>
                : <button className="chip" onClick={() => review(s.id, false)}>Take down</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Notices tab: guest questions to answer */
export function AskCard() {
  const { toast } = useStore();
  const [list, setList] = useState<{ id: number; q: string; name: string; answer: string | null; status: string }[] | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [showAll, setShowAll] = useState(false);
  const load = () => fetch("/api/ask?all=1").then((r) => (r.ok ? r.json() : null)).then((d) => d && setList(d.questions)).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!list) return null;
  const waiting = list.filter((q) => q.status === "pending");
  const shown = showAll ? list : waiting;
  async function send(id: number, body: Record<string, unknown>) {
    const r = await fetch("/api/ask", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return toast(d.error ?? "That didn't save.");
    load(); toast(body.remove ? "Removed" : "Answered ✓ It's on /ask now.");
  }
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
      <div className="sum-row" style={{ alignItems: "center" }}>
        <h3 style={{ fontSize: "1.1rem" }}>💬 Ask us anything {waiting.length > 0 && <span className="branch-tag">{waiting.length} to answer</span>}</h3>
        <button className="link-btn small" onClick={() => setShowAll(!showAll)}>{showAll ? "Just waiting ones" : "Edit answered ones"}</button>
      </div>
      <p className="small muted" style={{ margin: 0 }}>Answers show publicly at <a href="/ask" target="_blank" rel="noreferrer">/ask</a> with your first name. Remove anything that shouldn&apos;t be there.</p>
      {shown.length > 0 && (
        <ul className="check-list">
          {shown.map((q) => (
            <li key={q.id} style={{ flexWrap: "wrap" }}>
              <span style={{ width: "100%" }} className="small"><b>{q.q}</b>{q.name && <span className="muted"> · {q.name}</span>}</span>
              <textarea className="input" rows={2} maxLength={600} style={{ flex: 1, minWidth: "12rem" }} aria-label={`Answer to: ${q.q}`} value={drafts[q.id] ?? q.answer ?? ""} onChange={(e) => setDrafts({ ...drafts, [q.id]: e.target.value })} placeholder="Your answer…" />
              <span className="row" style={{ gap: "0.3rem" }}><button className="chip on" onClick={() => send(q.id, { answer: drafts[q.id] ?? q.answer ?? "" })}>{q.status === "answered" ? "Update" : "Answer"}</button><button className="chip" onClick={() => send(q.id, { remove: true })}>Remove</button></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Pet = { id: number; name: string; kind: string; age: string; img: string; status: string };
/** Events tab (owner): shelter pets looking for homes */
export function AdoptCard() {
  const { toast } = useStore();
  const [d, setD] = useState<{ pets: Pet[]; homed: Pet[] } | null>(null);
  const [f, setF] = useState({ name: "", kind: "dog", age: "", about: "", good_with: "", shelter: "", link: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => fetch("/api/adopt").then((r) => r.json()).then(setD).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!d) return null;
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast("Choose a photo.");
    setBusy(true);
    const form = new FormData();
    Object.entries(f).forEach(([k, v]) => form.set(k, v));
    form.set("file", file);
    const r = await fetch("/api/adopt", { method: "POST", body: form });
    const x = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast(x.error ?? "That didn't upload.");
    setF({ name: "", kind: "dog", age: "", about: "", good_with: "", shelter: f.shelter, link: "" }); setFile(null); (e.target as HTMLFormElement).reset(); load(); toast("Listed 🐾");
  }
  const homed = async (id: number, v: boolean) => { await fetch("/api/adopt", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, adopted: v }) }); load(); if (v) toast("Hooray! 🎉"); };
  const remove = async (id: number) => { await fetch(`/api/adopt?id=${id}`, { method: "DELETE" }); load(); };
  const all = [...d.pets, ...d.homed];
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginTop: "1rem" }}>
      <h3 style={{ fontSize: "1.1rem" }}>🐾 Adopt a friend · {d.pets.length} looking for a home</h3>
      <p className="small muted" style={{ margin: 0 }}>Shown at <a href="/adopt" target="_blank" rel="noreferrer">/adopt</a>. Add the shelter&apos;s https link so guests can contact them directly.</p>
      <form onSubmit={add} style={{ display: "grid", gap: "0.4rem", marginTop: "0.6rem" }}>
        <div className="row" style={{ flexWrap: "wrap", alignItems: "end" }}>
          <label className="field small" style={{ maxWidth: "10rem" }}>Name<input className="input" maxLength={40} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="field small" style={{ maxWidth: "9rem" }}>Who<select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{PET_KINDS.map((k) => <option key={k.id} value={k.id}>{k.icon} {k.label}</option>)}</select></label>
          <label className="field small" style={{ maxWidth: "9rem" }}>Age<input className="input" maxLength={30} value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })} placeholder="About 2 years" /></label>
          <label className="field small" style={{ maxWidth: "12rem" }}>Good with<input className="input" maxLength={80} value={f.good_with} onChange={(e) => setF({ ...f, good_with: e.target.value })} placeholder="kids, other dogs" /></label>
        </div>
        <label className="field small">About them<textarea className="input" rows={2} maxLength={400} value={f.about} onChange={(e) => setF({ ...f, about: e.target.value })} /></label>
        <div className="row" style={{ flexWrap: "wrap", alignItems: "end" }}>
          <label className="field small" style={{ maxWidth: "12rem" }}>Shelter<input className="input" maxLength={60} value={f.shelter} onChange={(e) => setF({ ...f, shelter: e.target.value })} /></label>
          <label className="field small" style={{ maxWidth: "16rem" }}>Shelter link <span className="muted">· https://</span><input className="input" maxLength={200} value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></label>
          <label className="field small" style={{ maxWidth: "14rem" }}>Photo<input className="input" type="file" accept="image/jpeg,image/png,image/webp" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} disabled={busy}>{busy ? "Uploading…" : "List them"}</button>
        </div>
      </form>
      {all.length > 0 && (
        <ul className="check-list">
          {all.map((p) => (
            <li key={p.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.img} alt="" className="latte-thumb" />
              <span style={{ flex: 1 }} className="small"><b>{p.name}</b><span className="muted"> · {p.age || p.kind}</span></span>
              <span className="row" style={{ gap: "0.3rem" }}><button className={`chip ${p.status === "adopted" ? "on" : ""}`} onClick={() => homed(p.id, p.status !== "adopted")}>{p.status === "adopted" ? "Adopted ❤️" : "Found a home"}</button><button className="chip" onClick={() => remove(p.id)}>Remove</button></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
