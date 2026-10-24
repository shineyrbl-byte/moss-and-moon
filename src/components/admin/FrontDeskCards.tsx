"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";

type Claim = { id: number; code: string; name: string; detail: string; created_at: string };
type Lost = { id: number; what: string; where_found: string; found_on: string; img: string | null; old: boolean; claims: Claim[] };

/** Notices tab: things left behind, and who says they're theirs */
export function LostFoundCard() {
  const { toast } = useStore();
  const [items, setItems] = useState<Lost[] | null>(null);
  const [f, setF] = useState({ what: "", where: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => fetch("/api/lost-found?staff=1").then((r) => (r.ok ? r.json() : null)).then((d) => d && setItems(d.items)).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!items) return null;
  async function post(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData();
    form.set("what", f.what); form.set("where", f.where);
    if (file) form.set("file", file);
    const r = await fetch("/api/lost-found", { method: "POST", body: form });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast(d.error ?? "That didn't save.");
    setF({ what: "", where: "" }); setFile(null); (e.target as HTMLFormElement).reset(); load(); toast("Posted ✓");
  }
  async function close(id: number, status: "returned" | "removed") {
    await fetch("/api/lost-found", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    load(); toast(status === "returned" ? "Back home ✓" : "Taken off the list");
  }
  const claims = items.reduce((n, i) => n + i.claims.length, 0);
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "1.1rem" }}>🧣 Lost &amp; found · {items.length} waiting {claims > 0 && <span className="branch-tag">{claims} claim{claims === 1 ? "" : "s"}</span>}</h3>
      <p className="small muted" style={{ margin: 0 }}>Shown for 30 days at <a href="/lost-found" target="_blank" rel="noreferrer">/lost-found</a>. Guests get a code like LF-1234: check it and their description before handing anything over.</p>
      <form onSubmit={post} className="row" style={{ alignItems: "end", flexWrap: "wrap", marginTop: "0.5rem" }}>
        <label className="field small" style={{ maxWidth: "14rem" }}>What is it?<input className="input" maxLength={60} required value={f.what} onChange={(e) => setF({ ...f, what: e.target.value })} placeholder="Blue umbrella" /></label>
        <label className="field small" style={{ maxWidth: "12rem" }}>Where <span className="muted">· optional</span><input className="input" maxLength={60} value={f.where} onChange={(e) => setF({ ...f, where: e.target.value })} placeholder="Window seat" /></label>
        <label className="field small" style={{ maxWidth: "14rem" }}>Photo <span className="muted">· optional</span><input className="input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} disabled={busy}>{busy ? "Posting…" : "Post it"}</button>
      </form>
      {items.length > 0 && (
        <ul className="check-list">
          {items.map((i) => (
            <li key={i.id} style={{ flexWrap: "wrap" }}>
              <span style={{ flex: 1 }} className="small"><b>{i.what}</b><span className="muted"> · {i.found_on}{i.where_found ? ` · ${i.where_found}` : ""}{i.old ? " · over 30 days, hidden from guests" : ""}</span></span>
              <span className="row" style={{ gap: "0.3rem" }}><button className="chip on" onClick={() => close(i.id, "returned")}>Returned</button><button className="chip" onClick={() => close(i.id, "removed")}>Remove</button></span>
              {i.claims.map((c) => <span key={c.id} className="small lost-claim"><b>{c.code}</b> · {c.name}: &ldquo;{c.detail}&rdquo;</span>)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Notices tab: notes for a stranger, read before they're passed on */
export function KindNotesCard() {
  const [list, setList] = useState<{ id: number; text: string; status: string; given: number }[] | null>(null);
  const load = () => fetch("/api/kind-notes?all=1").then((r) => (r.ok ? r.json() : null)).then((d) => d && setList(d.notes)).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!list) return null;
  const waiting = list.filter((n) => n.status === "pending");
  async function review(id: number, approve: boolean) {
    await fetch("/api/kind-notes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, approve }) });
    load();
  }
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "1.1rem" }}>💌 Notes for a stranger {waiting.length > 0 && <span className="branch-tag">{waiting.length} to read</span>}</h3>
      <p className="small muted" style={{ margin: 0 }}>{list.length - waiting.length} in the jar at <a href="/kind-notes" target="_blank" rel="noreferrer">/kind-notes</a>, passed on {list.reduce((n, x) => n + x.given, 0)} times. Until some are approved, guests get one of ours.</p>
      {waiting.length > 0 && (
        <ul className="check-list">
          {waiting.map((n) => (
            <li key={n.id}>
              <span style={{ flex: 1 }} className="small">&ldquo;{n.text}&rdquo;</span>
              <span className="row" style={{ gap: "0.3rem" }}><button className="chip on" onClick={() => review(n.id, true)}>Pass it on</button><button className="chip" onClick={() => review(n.id, false)}>Remove</button></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Bookings tab: board game wins guests have logged (remove any silly ones) */
export function ScoreboardCard() {
  const [d, setD] = useState<{ recent: { id: number; title: string; winner: string; players: number; created_at: string }[]; month: number } | null>(null);
  const load = () => fetch("/api/game-plays").then((r) => r.json()).then(setD).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!d) return null;
  async function remove(id: number) {
    await fetch(`/api/game-plays?id=${id}`, { method: "DELETE" });
    load();
  }
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginTop: "1rem" }}>
      <h3 style={{ fontSize: "1.1rem" }}>🏆 Board game scoreboard · {d.month} this month</h3>
      <p className="small muted" style={{ margin: 0 }}>Guests log wins at <a href="/scoreboard" target="_blank" rel="noreferrer">/scoreboard</a>. Remove any names that shouldn&apos;t be up there.</p>
      {d.recent.length > 0 && (
        <ul className="check-list">
          {d.recent.map((p) => (
            <li key={p.id}>
              <span style={{ flex: 1 }} className="small"><b>{p.winner}</b> won {p.title}<span className="muted"> · {p.players} playing · {p.created_at.slice(0, 16)}</span></span>
              <button className="chip" onClick={() => remove(p.id)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
