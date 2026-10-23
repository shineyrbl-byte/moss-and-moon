"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";

type M = { id: number; name: string; role: string; show: boolean; bio: string; favItem: string; creationCode: string; photo: string; emoji: string };

/** Owner, Team tab: who appears on the public "Meet the team" page, and what it says */
export default function TeamProfiles() {
  const { menu, toast } = useStore();
  const [team, setTeam] = useState<M[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const load = () => fetch("/api/admin/team").then((r) => (r.ok ? r.json() : { team: [] })).then((d) => setTeam(d.team)).catch(() => {});
  useEffect(() => { load(); }, []);
  const drinks = menu.filter((m) => ["coffee", "tea", "cold"].includes(m.cat) && !m.groups?.length).sort((a, b) => a.name.localeCompare(b.name));
  async function save(m: M) {
    const r = await fetch("/api/admin/team", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(m) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return toast(d.error ?? "That didn't save.");
    toast(`${m.name.split(" ")[0]}'s profile saved ✿`); load();
  }
  async function upload(m: M, file: File) {
    const fd = new FormData(); fd.append("file", file);
    const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return toast(d.error ?? "That photo didn't upload.");
    setTeam((t) => t.map((x) => (x.id === m.id ? { ...x, photo: d.url } : x)));
  }
  const set = (id: number, change: Partial<M>) => setTeam((t) => t.map((x) => (x.id === id ? { ...x, ...change } : x)));
  if (!team.length) return null;
  return (
    <section className="card" style={{ padding: "1rem", marginTop: "1rem" }}>
      <div className="sum-row" style={{ alignItems: "center" }}>
        <h3 style={{ fontSize: "1.15rem" }}>👋 Meet the team page <span className="muted small">· {team.filter((m) => m.show).length} shown</span></h3>
        <a className="btn btn-ghost btn-sm" href="/team" target="_blank" rel="noreferrer">See it ↗</a>
      </div>
      <p className="small muted">Only first names are shown, and only for people you switch on. Ask before showing someone.</p>
      <ul className="check-list">
        {team.map((m) => (
          <li key={m.id} style={{ flexDirection: "column", alignItems: "stretch" }}>
            <div className="row" style={{ alignItems: "center", gap: "0.6rem" }}>
              <span style={{ flex: 1 }}>{m.emoji} <b>{m.name}</b> <span className="muted small">{m.role}</span></span>
              <label className="row small" style={{ alignItems: "center", gap: "0.3rem" }}><input type="checkbox" checked={m.show} onChange={(e) => save({ ...m, show: e.target.checked })} /> Show</label>
              <button className="chip" onClick={() => setOpen(open === m.id ? null : m.id)}>{open === m.id ? "Close" : "Edit"}</button>
            </div>
            {open === m.id && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.6rem" }}>
                <label className="field small">A line about them<textarea className="input" rows={2} maxLength={240} value={m.bio} onChange={(e) => set(m.id, { bio: e.target.value })} placeholder="Latte art champion, plant whisperer, makes the best filter kaapi in Panjim." /></label>
                <div className="row">
                  <label className="field small">Favourite drink<select className="input" value={m.favItem} onChange={(e) => set(m.id, { favItem: e.target.value })}><option value="">None</option>{drinks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
                  <label className="field small">Drink lab code or link <span className="muted">· optional</span><input className="input" value={m.creationCode} onChange={(e) => set(m.id, { creationCode: e.target.value })} placeholder="e.g. AB12CD" /></label>
                </div>
                <div className="row" style={{ alignItems: "flex-end" }}>
                  <label className="field small" style={{ maxWidth: 110 }}>Emoji<input className="input" maxLength={4} value={m.emoji} onChange={(e) => set(m.id, { emoji: e.target.value })} /></label>
                  <label className="field small">Photo <span className="muted">· optional</span><input className="input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => e.target.files?.[0] && upload(m, e.target.files[0])} /></label>
                  {m.photo && <button className="chip" onClick={() => set(m.id, { photo: "" })}>Remove photo</button>}
                </div>
                <button className="btn btn-pink btn-sm" onClick={() => save(m)}>Save</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
