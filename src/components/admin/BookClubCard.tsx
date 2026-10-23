"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";
import { monthLabel, shiftMonth } from "@/lib/comeback";

type Pick = { month: string; bookId: string; title: string; date: string | null; time: string | null } | null;
type S = { month: string; pick: Pick; next: Pick; books: { id: string; title: string; author: string }[]; waiting: { id: number; name: string; stars: number; text: string; status: string; book_id: string }[] };

function PickForm({ month, pick, books, onSaved }: { month: string; pick: Pick; books: S["books"]; onSaved: () => void }) {
  const { toast } = useStore();
  const [f, setF] = useState({ bookId: pick?.bookId ?? "", date: pick?.date ?? "", time: pick?.time ?? "18:30" });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/book-club", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month, bookId: f.bookId, ...(f.date ? { date: f.date, time: f.time } : {}) }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    toast(f.date ? "Saved, and the meet-up is in Events ✓" : "Saved ✓"); onSaved();
  }
  return (
    <form className="row" style={{ alignItems: "end", flexWrap: "wrap" }} onSubmit={save}>
      <label className="field" style={{ minWidth: "14rem" }}>{monthLabel(month)}
        <select className="input" value={f.bookId} required onChange={(e) => setF({ ...f, bookId: e.target.value })}>
          <option value="">Pick a book…</option>
          {books.map((b) => <option key={b.id} value={b.id}>{b.title}{b.author ? ` · ${b.author}` : ""}</option>)}
        </select>
      </label>
      <label className="field" style={{ maxWidth: "11rem" }}>Meet-up <span className="muted small">· optional</span><input className="input" type="date" value={f.date} min={`${month}-01`} max={`${month}-31`} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
      <label className="field" style={{ maxWidth: "8rem" }}>Time<input className="input" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></label>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: "0.6rem" }}>Save</button>
    </form>
  );
}

/** Events tab: the book club (owners choose the book; any staff can approve guests' thoughts) */
export default function BookClubCard({ canEdit }: { canEdit: boolean }) {
  const [s, setS] = useState<S | null>(null);
  const [key, setKey] = useState(0);
  const load = () => fetch("/api/book-club?staff=1").then((r) => (r.ok ? r.json() : null)).then((d) => { setS(d); setKey((k) => k + 1); }).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!s) return null;
  async function review(id: number, approve: boolean) {
    await fetch("/api/book-club", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, approve }) });
    load();
  }
  const waiting = s.waiting.filter((t) => t.status === "pending");
  const title = (id: string) => s.books.find((b) => b.id === id)?.title ?? id;
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "1.15rem" }}>📚 Book club {waiting.length > 0 && <span className="branch-tag">{waiting.length} to check</span>}</h3>
      <p className="small muted">Shown at <a href="/book-club" target="_blank" rel="noreferrer">/book-club</a>. Books come from the shelf (Bookings tab). A meet-up date adds a free event.</p>
      {canEdit ? (
        <div key={key}>
          <PickForm month={s.month} pick={s.pick} books={s.books} onSaved={load} />
          <PickForm month={shiftMonth(s.month, 1)} pick={s.next} books={s.books} onSaved={load} />
        </div>
      ) : <p className="small">This month: <b>{s.pick?.title ?? "not chosen yet"}</b> · next: <b>{s.next?.title ?? "not chosen yet"}</b></p>}
      {waiting.length > 0 && (
        <ul className="check-list">
          {waiting.map((t) => (
            <li key={t.id}>
              <span style={{ flex: 1 }} className="small"><b>{t.name}</b> {"★".repeat(t.stars)}<span className="muted"> · {title(t.book_id)}</span>{t.text && <><br />{t.text}</>}</span>
              <span className="row" style={{ gap: "0.3rem" }}>
                <button className="chip on" onClick={() => review(t.id, true)}>Show it</button>
                <button className="chip" onClick={() => review(t.id, false)}>Remove</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
