"use client";
import "./page.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import HiddenMoon from "@/components/HiddenMoon";
import { SPOT_KINDS, type Spot } from "@/lib/nearby";
import { OWN_CUP_OFF } from "@/lib/pricing";

export default function Nearby() {
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [kind, setKind] = useState<string>("all");
  const [dog, setDog] = useState(false);
  useEffect(() => { fetch("/api/nearby").then((r) => r.json()).then((d) => setSpots(d.spots ?? [])).catch(() => setSpots([])); }, []);
  const list = (spots ?? []).filter((s) => (kind === "all" || s.kind === kind) && (!dog || s.dog));
  const kinds = SPOT_KINDS.filter((k) => spots?.some((s) => s.kind === k.id));
  return (
    <div className="page" style={{ maxWidth: "50rem" }}>
      <p className="eyebrow">after your coffee</p>
      <h1 className="h2">Around the <em>corner</em></h1>
      <p className="lead">The places our team loves near the café, with how long it takes to walk there<HiddenMoon id="m-nearby-6w" style={{ marginLeft: "0.25rem" }} />.</p>
      <p className="small" style={{ margin: "0.4rem 0 0" }}><Link href="/sunset">🌅 Tonight&apos;s sunset and golden hour →</Link></p>
      <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap", margin: "0.6rem 0 1rem" }}>
        <button className={`chip ${kind === "all" ? "on" : ""}`} aria-pressed={kind === "all"} onClick={() => setKind("all")}>All</button>
        {kinds.map((k) => <button key={k.id} className={`chip ${kind === k.id ? "on" : ""}`} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>{k.icon} {k.label}</button>)}
        <button className={`chip ${dog ? "on" : ""}`} aria-pressed={dog} onClick={() => setDog((d) => !d)}>🐾 Dog-friendly</button>
      </div>
      <ul className="spots">
        {list.map((s) => {
          const k = SPOT_KINDS.find((x) => x.id === s.kind)!;
          return (
            <li key={s.id} className="card spot">
              <span className="spot-icon" aria-hidden="true">{k.icon}</span>
              <div>
                <b>{s.name}</b>
                <p className="small" style={{ margin: "0.25rem 0" }}>{s.blurb}</p>
                <span className="tiny muted">🚶 {s.walk_min} min walk{s.dog ? " · 🐾 dogs welcome" : ""}{s.map_url && <> · <a href={s.map_url} target="_blank" rel="noopener noreferrer">Map ↗</a></>}</span>
              </div>
            </li>
          );
        })}
        {spots && !list.length && <p className="muted">Nothing here with those filters.</p>}
      </ul>
      <p className="small muted" style={{ marginTop: "1rem" }}>Taking a drink for the walk? Bring your own cup and it&apos;s ₹{OWN_CUP_OFF} off each drink. And <Link href="/pups">dogs are welcome</Link> back at the café too.</p>
    </div>
  );
}
