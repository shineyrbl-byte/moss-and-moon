"use client";
import { useState } from "react";
import { useStore } from "../Store";
import { rupees } from "@/lib/pricing";

type Idea = { baseItemId: string; name: string; desc: string; price: number; why: string };

/** Owner: ideas for today's special that use up what we have too much of */
export default function SpecialsCard() {
  const { toast, find } = useStore();
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function think() {
    setBusy(true);
    const r = await fetch("/api/admin/specials");
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return toast(d.error);
    setIdeas(d.ideas);
    setProvider(d.provider);
  }
  async function add(i: Idea) {
    const r = await fetch("/api/admin/specials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(i) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    toast(`“${i.name}” is on today's menu ✿`);
    setIdeas((x) => x?.filter((y) => y !== i) ?? null);
  }
  const set = (idx: number, patch: Partial<Idea>) => setIdeas((x) => x!.map((y, j) => (j === idx ? { ...y, ...patch } : y)));
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
      <div className="sum-row" style={{ alignItems: "center" }}>
        <h3 style={{ fontSize: "1.15rem" }}>✨ Special of the day</h3>
        <span className="row" style={{ gap: "0.4rem" }}>
        <a className="btn btn-ghost btn-sm" href="/print/menu" target="_blank">🖨 Printable menu</a>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={think}>{busy ? "Thinking…" : ideas ? "More ideas" : "Suggest a special"}</button>
        </span>
      </div>
      <p className="small muted">Ideas that use up overstocked ingredients and bakes that keep getting thrown away. Adding one puts it on the menu for today only.</p>
      {ideas && !ideas.length && <p className="small muted">No ideas right now.</p>}
      {ideas?.map((i, idx) => (
        <div key={idx} className="branch-row">
          <div className="row">
            <label className="field">Name<input className="input" maxLength={40} value={i.name} onChange={(e) => set(idx, { name: e.target.value })} /></label>
            <label className="field" style={{ maxWidth: "8rem" }}>Price<input className="input" inputMode="numeric" value={i.price} onChange={(e) => set(idx, { price: Number(e.target.value.replace(/\D/g, "")) })} /></label>
          </div>
          <label className="field">Description<input className="input" maxLength={160} value={i.desc} onChange={(e) => set(idx, { desc: e.target.value })} /></label>
          <p className="small muted">Based on {find(i.baseItemId)?.name ?? i.baseItemId} ({rupees(find(i.baseItemId)?.price ?? 0)}). {i.why}</p>
          <div><button className="btn btn-pink btn-sm" onClick={() => add(i)}>Put on today&apos;s menu</button></div>
        </div>
      ))}
      {ideas && <p className="tiny muted">{provider ? `Ideas by ${provider === "claude" ? "Claude" : "Gemini"}.` : "Simple idea (connect Gemini or Claude for creative ones)."}</p>}
    </section>
  );
}
