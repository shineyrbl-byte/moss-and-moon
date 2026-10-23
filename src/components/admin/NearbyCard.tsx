"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";
import { SPOT_KINDS, type Spot } from "@/lib/nearby";

const EMPTY = { name: "", kind: "beach", blurb: "", walk_min: 5, dog: false, map_url: "" };
type Draft = typeof EMPTY & { id?: number };

/** Notices tab: the "Around the corner" guide. Owners add, edit and remove places. */
export default function NearbyCard({ canEdit }: { canEdit: boolean }) {
  const { toast } = useStore();
  const [spots, setSpots] = useState<Spot[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  useEffect(() => { fetch("/api/nearby").then((r) => r.json()).then((d) => setSpots(d.spots ?? [])).catch(() => {}); }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/nearby", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setSpots(d.spots); setDraft(null); toast("Saved ✓");
  }
  async function remove(s: Spot) {
    const r = await fetch(`/api/nearby?id=${s.id}`, { method: "DELETE" });
    if (r.ok) setSpots((await r.json()).spots);
  }
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
      <div className="sum-row" style={{ alignItems: "center" }}>
        <h3 style={{ fontSize: "1.15rem" }}>🗺 Around the corner · {spots.length} place{spots.length === 1 ? "" : "s"}</h3>
        {canEdit && !draft && <button className="btn btn-ghost btn-sm" onClick={() => setDraft({ ...EMPTY })}>+ Add a place</button>}
      </div>
      <p className="small muted">Shown at <a href="/nearby" target="_blank" rel="noreferrer">/nearby</a>. The starting list is made up: swap in the real places near you.</p>
      {draft && (
        <form className="nearby-form" onSubmit={save}>
          <div className="row">
            <label className="field">Name<input className="input" value={draft.name} maxLength={60} required onChange={(e) => set("name", e.target.value)} /></label>
            <label className="field">Kind<select className="input" value={draft.kind} onChange={(e) => set("kind", e.target.value)}>{SPOT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.icon} {k.label}</option>)}</select></label>
            <label className="field" style={{ maxWidth: "8rem" }}>Walk (min)<input className="input" type="number" min={1} max={120} value={draft.walk_min} onChange={(e) => set("walk_min", Number(e.target.value))} /></label>
          </div>
          <label className="field">Why we love it<textarea className="input" rows={2} maxLength={300} value={draft.blurb} onChange={(e) => set("blurb", e.target.value)} /></label>
          <div className="row" style={{ alignItems: "end" }}>
            <label className="field">Map link <span className="muted small">· optional, https://…</span><input className="input" value={draft.map_url} maxLength={300} onChange={(e) => set("map_url", e.target.value)} /></label>
            <label className="row small" style={{ gap: "0.35rem", alignItems: "center", paddingBottom: "0.6rem" }}><input type="checkbox" checked={draft.dog} onChange={(e) => set("dog", e.target.checked)} /> 🐾 Dog-friendly</label>
          </div>
          <span className="row" style={{ gap: "0.5rem" }}>
            <button className="btn btn-pink btn-sm">Save</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(null)}>Cancel</button>
          </span>
        </form>
      )}
      <ul className="check-list">
        {spots.map((s) => (
          <li key={s.id}>
            <span style={{ flex: 1 }}>{SPOT_KINDS.find((k) => k.id === s.kind)?.icon} <b>{s.name}</b> <span className="muted small">· {s.walk_min} min{s.dog ? " · 🐾" : ""}</span></span>
            {canEdit && <span className="row" style={{ gap: "0.3rem" }}>
              <button className="chip" onClick={() => setDraft({ id: s.id, name: s.name, kind: s.kind, blurb: s.blurb, walk_min: s.walk_min, dog: s.dog, map_url: s.map_url })}>Edit</button>
              <button className="chip" onClick={() => remove(s)}>Remove</button>
            </span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
