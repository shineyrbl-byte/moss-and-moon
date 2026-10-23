"use client";
import { useEffect, useState } from "react";

type N = { id: number; to_name: string; from_name: string; text: string; created_at: string };

/** Staff page and Admin → Team: kind notes guests left on the Meet the team page */
export default function ThanksNotes({ showEmpty = false }: { showEmpty?: boolean }) {
  const [notes, setNotes] = useState<N[] | null>(null);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState(false);
  const load = () => fetch("/api/team/notes").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) { setNotes(d.notes); setAll(d.all); } }).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!notes || (!notes.length && !showEmpty)) return null;
  const shown = open ? notes : notes.slice(0, 3);
  async function remove(n: N) {
    const r = await fetch(`/api/team/notes?id=${n.id}`, { method: "DELETE" });
    if (r.ok) setNotes((x) => x!.filter((y) => y.id !== n.id));
  }
  return (
    <section className="card thanks-card">
      <h3 style={{ fontSize: "1.1rem" }}>💌 {all ? "Notes for the team" : "Notes for you"} <span className="muted small">· {notes.length}</span></h3>
      {!notes.length && <p className="small muted">None yet. Guests can leave one on the <a href="/team">Meet the team</a> page.</p>}
      <ul className="thanks-list">
        {shown.map((n) => (
          <li key={n.id}>
            <p style={{ margin: 0 }}>&ldquo;{n.text}&rdquo;</p>
            <span className="tiny muted">from {n.from_name}{all ? ` to ${n.to_name.split(" ")[0]}` : ""} · {n.created_at.slice(0, 10)}</span>
            {all && <button className="link-btn tiny" onClick={() => remove(n)}>Remove</button>}
          </li>
        ))}
      </ul>
      {notes.length > 3 && <button className="link-btn small" onClick={() => setOpen((o) => !o)}>{open ? "Show fewer" : `Show all ${notes.length}`}</button>}
    </section>
  );
}
