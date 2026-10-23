"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";

type P = { id: number; url: string; caption: string; name: string; status: "pending" | "approved"; kind?: "cafe" | "pup" | "doodle"; created_at: string };

/** Reviews tab: photos guests shared, waiting ones first */
export default function PhotosCard() {
  const { toast } = useStore();
  const [list, setList] = useState<P[]>([]);
  const load = () => fetch("/api/photos?all=1").then((r) => (r.ok ? r.json() : { photos: [] })).then((d) => setList(d.photos)).catch(() => {});
  useEffect(() => { load(); }, []);
  async function review(p: P, approve: boolean) {
    await fetch("/api/photos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, approve }) });
    toast(approve ? "Up on the wall ✿" : "Removed");
    load();
  }
  const waiting = list.filter((p) => p.status === "pending").length;
  if (!list.length) return <section className="card" style={{ padding: "1rem", marginBottom: "1rem" }}><h3 style={{ fontSize: "1.1rem" }}>📸 Guest photos</h3><p className="small muted">None yet. Guests can share one from the &ldquo;Life at Moss &amp; Moon&rdquo; section on the home page, or their dog on the <a href="/pups">pups page</a>.</p></section>;
  return (
    <section className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "1.1rem" }}>📸 Guest photos {waiting > 0 && <span className="branch-tag">{waiting} waiting</span>}</h3>
      <ul className="photo-review">
        {list.map((p) => (
          <li key={p.id} className={p.status}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.caption || `Photo by ${p.name}`} loading="lazy" /></a>
            <span className="small">{p.kind === "pup" && <span className="branch-tag">🐾 pup wall</span>}{p.kind === "doodle" && <span className="branch-tag">🎨 doodle</span>} <b>{p.name}</b>{p.caption ? `: ${p.caption}` : ""}<br /><span className="tiny muted">{p.created_at.slice(0, 10)} · {p.status === "pending" ? "waiting" : "on the wall"}</span></span>
            <span className="row" style={{ gap: "0.3rem" }}>
              {p.status === "pending" && <button className="chip on" onClick={() => review(p, true)}>Approve</button>}
              <button className="chip" onClick={() => review(p, false)}>Remove</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
