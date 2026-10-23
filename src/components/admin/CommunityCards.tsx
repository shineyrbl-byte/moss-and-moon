"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";

/** Orders tab: cups saved by guests bringing their own (owners set the monthly goal) */
export function CupsCard({ canEdit }: { canEdit: boolean }) {
  const { toast } = useStore();
  const [c, setC] = useState<{ thisMonth: number; total: number; goal: number } | null>(null);
  const [goal, setGoal] = useState("");
  useEffect(() => { fetch("/api/cups").then((r) => r.json()).then((d) => { setC(d); setGoal(String(d.goal)); }).catch(() => {}); }, []);
  if (!c) return null;
  async function save() {
    const r = await fetch("/api/cups", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal: Number(goal) }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setC({ ...c!, goal: d.goal }); toast("Goal saved ✓");
  }
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "1.1rem" }}>♻️ Cups saved · {c.thisMonth} this month of {c.goal}</h3>
      <p className="small muted" style={{ margin: 0 }}>{c.total} in total, from orders with the own-cup discount. Shown at <a href="/cups-saved" target="_blank" rel="noreferrer">/cups-saved</a>.</p>
      {canEdit && <div className="row" style={{ alignItems: "end", marginTop: "0.5rem" }}><label className="field small" style={{ maxWidth: "10rem" }}>Monthly goal<input className="input" type="number" min={1} value={goal} onChange={(e) => setGoal(e.target.value)} /></label><button className="btn btn-ghost btn-sm" style={{ marginBottom: "0.6rem" }} onClick={save}>Save</button></div>}
    </section>
  );
}

/** Notices tab: this week's poll (any staff can set it until the first vote) */
export function PollCard() {
  const { toast } = useStore();
  const [p, setP] = useState<{ q: string; choices: string[]; counts: number[]; total: number; custom: boolean } | null>(null);
  const [edit, setEdit] = useState<{ q: string; choices: string } | null>(null);
  const load = () => fetch("/api/poll?staff=1").then((r) => (r.ok ? r.json() : null)).then(setP).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!p) return null;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/poll", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: edit!.q, choices: edit!.choices.split("\n") }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setEdit(null); load(); toast("This week's poll is set ✓");
  }
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
      <div className="sum-row" style={{ alignItems: "center" }}>
        <h3 style={{ fontSize: "1.1rem" }}>🗳 This week&apos;s poll · {p.total} vote{p.total === 1 ? "" : "s"}</h3>
        {!edit && p.total === 0 && <button className="link-btn small" onClick={() => setEdit({ q: p.q, choices: p.choices.join("\n") })}>Write your own</button>}
      </div>
      <p className="small" style={{ margin: "0.2rem 0" }}><b>{p.q}</b> <span className="muted">· {p.custom ? "yours" : "picked automatically"} · <a href="/poll" target="_blank" rel="noreferrer">/poll</a></span></p>
      {!edit && <p className="small muted" style={{ margin: 0 }}>{p.choices.map((c, i) => `${c} ${p.counts[i]}`).join(" · ")}</p>}
      {edit && (
        <form onSubmit={save} style={{ display: "grid", gap: "0.5rem", marginTop: "0.5rem" }}>
          <label className="field small">Question<input className="input" maxLength={100} value={edit.q} onChange={(e) => setEdit({ ...edit, q: e.target.value })} /></label>
          <label className="field small">Answers, one per line (2 to 5)<textarea className="input" rows={4} value={edit.choices} onChange={(e) => setEdit({ ...edit, choices: e.target.value })} /></label>
          <span className="row" style={{ gap: "0.4rem" }}><button className="btn btn-pink btn-sm">Save</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancel</button></span>
        </form>
      )}
    </section>
  );
}

/** Notices tab: six-word stories waiting for a look */
export function StoriesCard() {
  const [list, setList] = useState<{ id: number; text: string; name: string; status: string }[] | null>(null);
  const load = () => fetch("/api/stories?all=1").then((r) => (r.ok ? r.json() : null)).then((d) => d && setList(d.stories)).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!list) return null;
  const waiting = list.filter((s) => s.status === "pending");
  async function review(id: number, approve: boolean) {
    await fetch("/api/stories", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, approve }) });
    load();
  }
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "1.1rem" }}>✍️ Six-word stories {waiting.length > 0 && <span className="branch-tag">{waiting.length} to check</span>}</h3>
      <p className="small muted" style={{ margin: 0 }}>{list.length - waiting.length} shown at <a href="/stories" target="_blank" rel="noreferrer">/stories</a>. The most-hearted one from the last 7 days goes on the TV board.</p>
      {waiting.length > 0 && (
        <ul className="check-list">
          {waiting.map((s) => (
            <li key={s.id}>
              <span style={{ flex: 1 }} className="small">&ldquo;{s.text}&rdquo;<span className="muted"> · {s.name || "anonymous"}</span></span>
              <span className="row" style={{ gap: "0.3rem" }}><button className="chip on" onClick={() => review(s.id, true)}>Show it</button><button className="chip" onClick={() => review(s.id, false)}>Remove</button></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Bookings tab (owner): hints for the blind-date shelf */
export function BlindDateCard() {
  const { toast } = useStore();
  const [books, setBooks] = useState<{ id: string; title: string; hints: string[] }[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState(["", "", ""]);
  useEffect(() => { fetch("/api/blind-date?owner=1").then((r) => (r.ok ? r.json() : null)).then((d) => d && setBooks(d.books)).catch(() => {}); }, []);
  if (!books) return null;
  async function save(id: string, hints: string[]) {
    const r = await fetch("/api/blind-date", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, hints }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setBooks(d.books); setOpen(null); toast(hints.some(Boolean) ? "Wrapped ✓" : "Unwrapped: it's off the blind-date shelf");
  }
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginTop: "1rem" }}>
      <h3 style={{ fontSize: "1.1rem" }}>📦 Blind date with a book · {books.filter((b) => b.hints.length).length} wrapped</h3>
      <p className="small muted" style={{ margin: 0 }}>Three hints per book, no title. Shown at <a href="/blind-date" target="_blank" rel="noreferrer">/blind-date</a>. Clear the hints to take a book off.</p>
      <ul className="check-list">
        {books.map((b) => (
          <li key={b.id} style={{ flexWrap: "wrap" }}>
            <span style={{ flex: 1 }} className="small"><b>{b.title}</b>{b.hints.length ? <span className="muted"> · {b.hints.join(" / ")}</span> : <span className="muted"> · not wrapped</span>}</span>
            {open !== b.id ? <button className="chip" onClick={() => { setOpen(b.id); setDraft([0, 1, 2].map((i) => b.hints[i] ?? "")); }}>{b.hints.length ? "Edit" : "Wrap it"}</button> : (
              <form style={{ width: "100%", display: "grid", gap: "0.4rem", marginTop: "0.4rem" }} onSubmit={(e) => { e.preventDefault(); save(b.id, draft); }}>
                {draft.map((h, i) => <input key={i} className="input" maxLength={60} placeholder={`Hint ${i + 1}`} value={h} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? e.target.value : x)))} />)}
                <span className="row" style={{ gap: "0.4rem" }}><button className="btn btn-pink btn-sm">Save</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(null)}>Cancel</button></span>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
