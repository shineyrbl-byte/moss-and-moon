"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";

/** Notices tab: post this week's latte art (any staff), and see how the vote's going */
export function LatteArtCard({ me }: { me: { id: number; role: string } | null }) {
  const { toast } = useStore();
  const [w, setW] = useState<{ entries: { id: number; staff_id: number; staff_name: string; img: string; caption: string; votes: number }[] } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ id: number; name: string; img: string; caption: string }[]>([]);
  const load = () => {
    fetch("/api/latte-art").then((r) => r.json()).then(setW).catch(() => {});
    fetch("/api/latte-art?pending=1").then((r) => (r.ok ? r.json() : null)).then((d) => d && setPending(d.pending)).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  if (!w) return null;
  async function review(id: number, approve: boolean) {
    await fetch("/api/latte-art", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, approve }) });
    toast(approve ? "It's in this week's vote ☕" : "Turned down, and the photo is deleted"); load();
  }
  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast("Choose a photo first.");
    setBusy(true);
    const form = new FormData();
    form.set("file", file); form.set("caption", caption);
    const r = await fetch("/api/latte-art", { method: "POST", body: form });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast(d.error ?? "That didn't upload.");
    setFile(null); setCaption(""); (e.target as HTMLFormElement).reset(); load(); toast("Posted ☕ Good luck!");
  }
  async function remove(id: number) {
    await fetch(`/api/latte-art?id=${id}`, { method: "DELETE" });
    load();
  }
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "1.1rem" }}>🎨 Latte art of the week · {w.entries.length} entr{w.entries.length === 1 ? "y" : "ies"}</h3>
      <p className="small muted" style={{ margin: 0 }}>Post up to three pours a week. Guests vote at <a href="/latte-art" target="_blank" rel="noreferrer">/latte-art</a> until Sunday; the winner goes on the TV board and your team profile.</p>
      <form onSubmit={post} className="row" style={{ alignItems: "end", flexWrap: "wrap", marginTop: "0.5rem" }}>
        <label className="field small" style={{ maxWidth: "14rem" }}>Photo<input className="input" type="file" accept="image/jpeg,image/png,image/webp" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        <label className="field small" style={{ maxWidth: "14rem" }}>Caption <span className="muted">· optional</span><input className="input" maxLength={60} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Swan on oat milk" /></label>
        <button className="btn btn-pink btn-sm" style={{ marginBottom: "0.6rem" }} disabled={busy}>{busy ? "Uploading…" : "Post it"}</button>
      </form>
      {pending.length > 0 && (
        <>
          <p className="small" style={{ margin: "0.6rem 0 0.2rem" }}><b>Guests&apos; pours waiting for a look ({pending.length})</b></p>
          <ul className="check-list">
            {pending.map((a) => (
              <li key={a.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.img} alt="" className="latte-thumb" />
                <span style={{ flex: 1 }} className="small"><b>{a.name}</b> (guest){a.caption && <span className="muted"> · {a.caption}</span>}</span>
                <button className="chip" onClick={() => review(a.id, true)}>Approve</button> <button className="chip" onClick={() => review(a.id, false)}>Turn down</button>
              </li>
            ))}
          </ul>
        </>
      )}
      {w.entries.length > 0 && (
        <ul className="check-list">
          {w.entries.map((a) => (
            <li key={a.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.img} alt="" className="latte-thumb" />
              <span style={{ flex: 1 }} className="small"><b>{a.staff_name}</b>{a.caption && <span className="muted"> · {a.caption}</span>} · {a.votes} vote{a.votes === 1 ? "" : "s"}</span>
              {(me?.role === "owner" || me?.id === a.staff_id) && <button className="chip" onClick={() => remove(a.id)}>Remove</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Notices tab: guest recipes waiting for a read */
export function GuestRecipesCard() {
  const [list, setList] = useState<{ id: number; title: string; name: string; intro: string; ingredients: string[]; steps: string[]; status: string }[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const load = () => fetch("/api/guest-recipes?all=1").then((r) => (r.ok ? r.json() : null)).then((d) => d && setList(d.recipes)).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!list) return null;
  const waiting = list.filter((r) => r.status === "pending");
  async function review(id: number, approve: boolean) {
    await fetch("/api/guest-recipes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, approve }) });
    load();
  }
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "1.1rem" }}>📝 Recipe swap {waiting.length > 0 && <span className="branch-tag">{waiting.length} to read</span>}</h3>
      <p className="small muted" style={{ margin: 0 }}>{list.length - waiting.length} shared at <a href="/recipe-swap" target="_blank" rel="noreferrer">/recipe-swap</a>. The three most-loved show on the recipes page.</p>
      {waiting.length > 0 && (
        <ul className="check-list">
          {waiting.map((r) => (
            <li key={r.id} style={{ flexWrap: "wrap" }}>
              <span style={{ flex: 1 }} className="small"><button className="link-btn" onClick={() => setOpen(open === r.id ? null : r.id)}><b>{r.title}</b></button><span className="muted"> · {r.name || "anonymous"}</span></span>
              <span className="row" style={{ gap: "0.3rem" }}><button className="chip on" onClick={() => review(r.id, true)}>Share it</button><button className="chip" onClick={() => review(r.id, false)}>Remove</button></span>
              {open === r.id && <div className="small" style={{ width: "100%" }}>{r.intro && <p style={{ margin: "0.2rem 0" }}>{r.intro}</p>}<b>Ingredients:</b> {r.ingredients.join(" · ")}<br /><b>Steps:</b> {r.steps.map((s, i) => `${i + 1}. ${s}`).join(" ")}</div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Notices tab (owner): the I spy list for kids */
export function ISpyCard() {
  const { toast } = useStore();
  const [text, setText] = useState<string | null>(null);
  useEffect(() => { fetch("/api/ispy").then((r) => r.json()).then((d) => setText(d.items.join("\n"))).catch(() => {}); }, []);
  if (text === null) return null;
  async function save(items: string[]) {
    const r = await fetch("/api/ispy", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setText(d.items.join("\n")); toast("Saved ✓");
  }
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "1.1rem" }}>👀 I spy, for kids</h3>
      <p className="small muted" style={{ margin: 0 }}>Things to spot around the café, one per line (up to 16). Shown at <a href="/i-spy" target="_blank" rel="noreferrer">/i-spy</a>. Only list things that are really there!</p>
      <textarea className="input" rows={7} value={text} onChange={(e) => setText(e.target.value)} style={{ marginTop: "0.5rem" }} aria-label="Things to spot" />
      <span className="row" style={{ gap: "0.4rem" }}><button className="btn btn-pink btn-sm" onClick={() => save(text.split("\n"))}>Save</button><button className="btn btn-ghost btn-sm" onClick={() => save([])}>Use the café&apos;s list</button></span>
    </section>
  );
}
