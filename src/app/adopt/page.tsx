"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PET_KINDS } from "@/lib/pets";

type Pet = { id: number; name: string; kind: string; age: string; about: string; good_with: string; shelter: string; link: string; img: string; status: string };

export default function Adopt() {
  const [d, setD] = useState<{ pets: Pet[]; homed: Pet[] } | null>(null);
  const [kind, setKind] = useState("all");
  useEffect(() => { fetch("/api/adopt").then((r) => r.json()).then(setD).catch(() => setD({ pets: [], homed: [] })); }, []);
  if (!d) return <div className="page"><p className="muted">Looking for wagging tails…</p></div>;
  const list = d.pets.filter((p) => kind === "all" || p.kind === kind);
  const icon = (k: string) => PET_KINDS.find((x) => x.id === k)?.icon ?? "🐾";
  return (
    <div className="page" style={{ maxWidth: "60rem" }}>
      <p className="eyebrow">looking for a home</p>
      <h1 className="h2">Adopt a <em>friend</em></h1>
      <p className="lead">Dogs, cats and the odd surprise from shelters near us, all hoping for a sofa of their own. Fall for someone? Get in touch with their shelter directly. Already have a pup? They&apos;re welcome here: see <Link href="/pups" className="link-btn">pups welcome</Link>.</p>
      {d.pets.length > 0 && (
        <div className="row" style={{ gap: "0.4rem", margin: "1rem 0", flexWrap: "wrap" }}>
          <button className={`chip ${kind === "all" ? "on" : ""}`} aria-pressed={kind === "all"} onClick={() => setKind("all")}>Everyone · {d.pets.length}</button>
          {PET_KINDS.filter((k) => d.pets.some((p) => p.kind === k.id)).map((k) => <button key={k.id} className={`chip ${kind === k.id ? "on" : ""}`} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>{k.icon} {k.label}s</button>)}
        </div>
      )}
      {list.length ? (
        <ul className="pet-grid">
          {list.map((p) => (
            <li key={p.id} className="card pet-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.img} alt={`${p.name}, a ${p.kind === "other" ? "pet" : p.kind} looking for a home`} loading="lazy" />
              <div className="pet-body">
                <b className="pet-name">{icon(p.kind)} {p.name}</b>
                {p.age && <span className="tiny muted">{p.age}</span>}
                {p.about && <p className="small" style={{ margin: 0 }}>{p.about}</p>}
                {p.good_with && <span className="tiny">💛 Good with {p.good_with}</span>}
                {p.shelter && <span className="tiny muted">At {p.shelter}</span>}
                {p.link ? <a className="btn btn-pink btn-sm" href={p.link} target="_blank" rel="noopener noreferrer">Meet {p.name} →</a> : <span className="tiny muted">Ask at the counter about {p.name}</span>}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="card muted center" style={{ padding: "1.6rem" }}>🐾 Nobody listed right now. Check back soon!</p>}
      {d.homed.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2 className="h3">Found their people ❤️</h2>
          <ul className="pet-homed">
            {d.homed.map((p) => (
              <li key={p.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.img} alt="" loading="lazy" /><span className="tiny"><b>{p.name}</b></span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
