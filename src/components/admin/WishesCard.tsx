"use client";
import { useEffect, useState } from "react";

type W = { id: number; text: string; name: string; status: string; created_at: string };

/** Notices tab: wishes on the tree since the last full moon; their words show once approved */
export default function WishesCard() {
  const [list, setList] = useState<W[] | null>(null);
  const load = () => fetch("/api/wishes?all=1").then((r) => (r.ok ? r.json() : null)).then((d) => d && setList(d.wishes)).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!list) return null;
  async function review(id: number, approve: boolean) {
    await fetch("/api/wishes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, approve }) });
    load();
  }
  const waiting = list.filter((w) => w.status === "pending");
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "1.15rem" }}>🌳 Wish tree · {list.length} this moon {waiting.length > 0 && <span className="branch-tag">{waiting.length} to check</span>}</h3>
      <p className="small muted">Wishes hang as ribbons at <a href="/wish-tree" target="_blank" rel="noreferrer">/wish-tree</a>; the words show once you approve them. The tree clears itself every full moon.</p>
      {waiting.length > 0 && (
        <ul className="check-list">
          {waiting.map((w) => (
            <li key={w.id}>
              <span style={{ flex: 1 }} className="small">&ldquo;{w.text}&rdquo;<span className="muted"> · {w.name || "anonymous"}</span></span>
              <span className="row" style={{ gap: "0.3rem" }}>
                <button className="chip on" onClick={() => review(w.id, true)}>Show it</button>
                <button className="chip" onClick={() => review(w.id, false)}>Remove</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
