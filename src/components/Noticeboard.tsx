"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "./Store";

type Note = { id: number; kind: string; name: string; text: string; contact: string | null; created_at: string };
export const KINDS: Record<string, { icon: string; label: string }> = {
  lost: { icon: "🧤", label: "Lost & found" },
  study: { icon: "📚", label: "Study buddy" },
  swap: { icon: "🔁", label: "Book & swap" },
  event: { icon: "🎶", label: "Happening" },
  other: { icon: "📌", label: "Other" },
};

/** Pinned notes, like paper on a cork board. compact = the home page teaser. */
export default function Noticeboard({ compact = false }: { compact?: boolean }) {
  const { toast } = useStore();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ kind: "study", name: "", text: "", contact: "" });
  const [error, setError] = useState("");

  const load = useCallback(() => fetch("/api/notices").then((r) => r.json()).then(setNotes).catch(() => setNotes([])), []);
  useEffect(() => { load(); }, [load]);

  async function pin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const r = await fetch("/api/notices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await r.json();
    if (!r.ok) return setError(d.error);
    toast("Thanks! It'll go up once a barista has a look ✿");
    setF({ ...f, text: "", contact: "" });
    setOpen(false);
  }

  const shown = (notes ?? []).filter((n) => filter === "all" || n.kind === filter).slice(0, compact ? 4 : 40);
  return (
    <div>
      {!compact && (
        <div className="chips" style={{ marginBottom: "1rem" }}>
          {["all", ...Object.keys(KINDS)].map((k) => (
            <button key={k} className={`chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{k === "all" ? "Everything" : `${KINDS[k].icon} ${KINDS[k].label}`}</button>
          ))}
        </div>
      )}
      <div className="cork">
        {notes === null && <p className="muted">Loading…</p>}
        {notes && !shown.length && <p className="cork-empty">Nothing pinned yet. Be the first ✿</p>}
        {shown.map((n, i) => (
          <article key={n.id} className={`note note-${n.kind}`} style={{ rotate: `${((n.id * 37) % 7) - 3}deg`, animationDelay: `${i * 60}ms` }}>
            <span className="pin" aria-hidden />
            <span className="small note-kind">{KINDS[n.kind]?.icon} {KINDS[n.kind]?.label}</span>
            <p>{n.text}</p>
            <span className="small note-by">— {n.name}{n.contact ? ` · ${n.contact}` : ""}</span>
          </article>
        ))}
      </div>
      <div className="row" style={{ justifyContent: "center", marginTop: "1.2rem" }}>
        {compact ? <Link href="/noticeboard" className="btn btn-ghost">See the whole board</Link> : null}
        <button className="btn btn-pink" onClick={() => setOpen((o) => !o)}>📌 Pin a note</button>
      </div>
      {open && (
        <form className="card booking" onSubmit={pin} style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.8rem", maxWidth: "34rem", marginInline: "auto" }}>
          <div className="chips" style={{ justifyContent: "flex-start" }} role="radiogroup" aria-label="What kind of note">
            {Object.entries(KINDS).map(([k, v]) => (
              <button type="button" key={k} role="radio" aria-checked={f.kind === k} className={`chip ${f.kind === k ? "on" : ""}`} onClick={() => setF({ ...f, kind: k })}>{v.icon} {v.label}</button>
            ))}
          </div>
          <label className="field">Your note<textarea className="input" rows={3} required minLength={10} maxLength={280} placeholder="Found a blue umbrella by the window seat on Tuesday…" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></label>
          <div className="row">
            <label className="field">Your name<input className="input" required maxLength={30} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label className="field">How to reach you (optional)<input className="input" maxLength={60} placeholder="Instagram handle, or “ask at the counter”" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></label>
          </div>
          <p className="tiny muted">Everyone can see the board, so please don&apos;t share your phone number. Notes stay up for 2 weeks after a barista approves them.</p>
          {error && <p className="error small">{error}</p>}
          <button className="btn btn-pink">Send it to the board</button>
        </form>
      )}
    </div>
  );
}
