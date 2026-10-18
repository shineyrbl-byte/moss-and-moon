"use client";
import { useEffect, useState } from "react";

type Item = { id: string; ok: boolean; label: string; why: string; tab: string; optional?: boolean };
type D = { items: Item[]; done: number; total: number; dismissed: boolean };

/** Owner, top of Overview: what's set up, what's left, and where to fix it */
export default function SetupCard({ go }: { go: (tab: string) => void }) {
  const [d, setD] = useState<D | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { fetch("/api/admin/setup").then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => {}); }, []);
  if (!d) return null;
  const allDone = d.done === d.total;
  if (allDone && d.dismissed) return null;
  async function dismiss() {
    await fetch("/api/admin/setup", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dismissed: true }) });
    setD({ ...d!, dismissed: true });
  }
  const todo = d.items.filter((i) => !i.ok && !i.optional);
  const extra = d.items.filter((i) => !i.ok && i.optional);
  return (
    <section className="card setup-card">
      <div className="sum-row" style={{ alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
        <h3 style={{ fontSize: "1.2rem" }}>{allDone ? "✅ All set up" : `🧭 Setup: ${d.done} of ${d.total} done`}</h3>
        <span className="row" style={{ gap: "0.4rem" }}>
          <button className="link-btn small" onClick={() => setOpen((o) => !o)}>{open ? "Hide" : allDone ? "Show extras" : "Show what's left"}</button>
          {allDone && <button className="link-btn small" onClick={dismiss}>Hide this card</button>}
        </span>
      </div>
      <div className="meter" aria-hidden style={{ maxWidth: "none" }}><span style={{ width: `${(d.done / d.total) * 100}%` }} /></div>
      {(open || (!allDone && todo.length <= 3)) && (
        <ul className="check-list">
          {[...todo, ...(open ? extra : [])].map((i) => (
            <li key={i.id}>
              <span style={{ flex: 1 }}><b>{i.label}</b>{i.optional && <span className="branch-tag">optional</span>}<br /><small className="muted">{i.why}</small></span>
              <button className="btn btn-ghost btn-sm" onClick={() => go(i.tab)}>Set up</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
