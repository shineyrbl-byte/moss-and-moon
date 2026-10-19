"use client";
import { useEffect, useState } from "react";
import { ROTATIONS } from "@/lib/menu";

/** Owner, Menu tab: which season's items are showing (by the calendar, or picked) */
export default function RotationCard() {
  const [d, setD] = useState<{ now: string; calendar: string; override: string } | null>(null);
  useEffect(() => { fetch("/api/admin/rotation").then((r) => r.json()).then(setD).catch(() => {}); }, []);
  if (!d) return null;
  async function set(rotation: string) {
    const r = await fetch("/api/admin/rotation", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rotation }) });
    if (r.ok) setD(await r.json());
  }
  const label = (id: string) => ROTATIONS.find((r) => r.id === id)?.label ?? id;
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
      <div className="sum-row" style={{ alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <h3 style={{ fontSize: "1.15rem" }}>🍂 Seasonal menu: {label(d.now)}</h3>
        <div className="chips" role="radiogroup" aria-label="Seasonal menu">
          <button role="radio" aria-checked={d.override === "auto"} className={`chip ${d.override === "auto" ? "on" : ""}`} onClick={() => set("auto")}>By the calendar</button>
          {ROTATIONS.map((r) => <button key={r.id} role="radio" aria-checked={d.override === r.id} className={`chip ${d.override === r.id ? "on" : ""}`} onClick={() => set(r.id)}>{r.label.split(" ")[0]}</button>)}
        </div>
      </div>
      <p className="small muted">Items marked for a season only show then, so the menu changes through the year without getting longer. Set it per item in “On the menu”.</p>
    </section>
  );
}
