"use client";
import "./page.css";
import { useEffect, useState } from "react";

type Art = { id: number; title: string; medium: string; size: string; price: number | null; img: string; sold: number };
type D = { artist: { name: string; bio: string; link: string } | null; works: Art[] };

export default function ArtistWall() {
  const [d, setD] = useState<D | null>(null);
  const [big, setBig] = useState<Art | null>(null);
  useEffect(() => { fetch("/api/art").then((r) => r.json()).then(setD).catch(() => setD({ artist: null, works: [] })); }, []);
  useEffect(() => { if (!big) return; const k = (e: KeyboardEvent) => e.key === "Escape" && setBig(null); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [big]);
  if (!d) return <div className="page"><p className="muted">Hanging the frames…</p></div>;
  return (
    <div className="page" style={{ maxWidth: "62rem" }}>
      <p className="eyebrow">on our walls</p>
      <h1 className="h2">The artist <em>wall</em></h1>
      <p className="lead">Every month we hang work by a local artist. Have a look before you visit, or wander over to the walls with your coffee.</p>
      {d.artist ? (
        <section className="card art-artist">
          <span className="tiny muted">🎨 Artist of the month</span>
          <h2 className="h3" style={{ margin: 0 }}>{d.artist.name}</h2>
          {d.artist.bio && <p className="small" style={{ margin: 0, whiteSpace: "pre-line" }}>{d.artist.bio}</p>}
          {d.artist.link && <a className="link-btn small" href={d.artist.link} target="_blank" rel="noopener noreferrer">See more of their work →</a>}
        </section>
      ) : null}
      {d.works.length ? (
        <ul className="art-grid">
          {d.works.map((w) => (
            <li key={w.id} className={`art-piece ${w.sold ? "sold" : ""}`}>
              <button className="art-frame" onClick={() => setBig(w)} aria-label={`See ${w.title} bigger`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={w.img} alt={`${w.title}${w.medium ? `, ${w.medium}` : ""}`} loading="lazy" />
              </button>
              <b>{w.title}</b>
              <span className="tiny muted">{[w.medium, w.size].filter(Boolean).join(" · ")}</span>
              <span className="small">{w.sold ? <span className="branch-tag">Sold</span> : w.price ? `₹${w.price.toLocaleString("en-IN")} · ask at the counter` : "Not for sale"}</span>
            </li>
          ))}
        </ul>
      ) : <p className="card muted center" style={{ padding: "1.6rem" }}>🖼 New pieces are on their way. Check back soon.</p>}
      {big && (
        <div className="art-zoom" role="dialog" aria-modal="true" aria-label={big.title} onClick={() => setBig(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={big.img} alt={big.title} />
          <p><b>{big.title}</b>{big.medium ? ` · ${big.medium}` : ""} <button className="btn btn-ghost btn-sm" onClick={() => setBig(null)}>Close</button></p>
        </div>
      )}
    </div>
  );
}
