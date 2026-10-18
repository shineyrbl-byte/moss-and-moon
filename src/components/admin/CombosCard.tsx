"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";
import { hourText } from "@/lib/cafe";
import type { Combo } from "@/lib/pricing";
import type { Category } from "@/lib/menu";

const CATS: { id: Category; label: string }[] = [{ id: "coffee", label: "Coffee" }, { id: "tea", label: "Tea" }, { id: "cold", label: "Cold drinks" }, { id: "food", label: "Food" }, { id: "bakes", label: "Bakes" }];
const HOURS = Array.from({ length: 25 }, (_, i) => i);
const blank = (): Combo => ({ id: "", name: "", price: 299, on: true, slots: [{ label: "Any coffee", cats: ["coffee"] }, { label: "Any bake", cats: ["bakes"] }] });

/** Owner, Menu tab: combo deals like "any coffee + a bake for ₹299", applied in the tray by themselves */
export default function CombosCard() {
  const { toast, menu } = useStore();
  const [list, setList] = useState<Combo[] | null>(null);
  const [saved, setSaved] = useState("");
  useEffect(() => { fetch("/api/admin/cafe-config").then((r) => r.json()).then((d) => { setList(d.combos); setSaved(JSON.stringify(d.combos)); }).catch(() => {}); }, []);
  if (!list) return null;
  const set = (i: number, patch: Partial<Combo>) => setList(list.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const setSlot = (i: number, k: number, patch: Partial<Combo["slots"][number]>) => set(i, { slots: list[i].slots.map((s, j) => (j === k ? { ...s, ...patch } : s)) });
  async function save() {
    const r = await fetch("/api/admin/cafe-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ combos: list }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setList(d.combos);
    setSaved(JSON.stringify(d.combos));
    toast("Combos saved ✿");
  }
  // What a typical combo would cost without the deal (the cheapest thing in each slot), to sanity-check the price
  const cheapest = (c: Combo) => c.slots.reduce((s, sl) => s + Math.min(...menu.filter((m) => (sl.items?.length ? sl.items.includes(m.id) : (sl.cats ?? []).includes(m.cat))).map((m) => m.price), 9999), 0);

  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
      <div className="sum-row" style={{ alignItems: "center" }}>
        <h3 style={{ fontSize: "1.15rem" }}>🍱 Combo deals</h3>
        {list.length < 8 && <button className="btn btn-ghost btn-sm" onClick={() => setList([...list, blank()])}>Add a combo</button>}
      </div>
      <p className="small muted">The tray applies these by itself when the right things are in it. Golden hour and last-hour deals don&apos;t stack on top.</p>
      {list.map((c, i) => {
        const low = cheapest(c);
        return (
          <div key={c.id || `new-${i}`} className="branch-row">
            <div className="row" style={{ alignItems: "flex-end" }}>
              <label className="field">Name<input className="input" maxLength={40} value={c.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="e.g. Breakfast combo" /></label>
              <label className="field" style={{ maxWidth: "7rem" }}>Price ₹<input className="input" inputMode="numeric" value={c.price} onChange={(e) => set(i, { price: Number(e.target.value.replace(/\D/g, "")) })} /></label>
              <label className="row small" style={{ gap: "0.3rem", alignItems: "center" }}><input type="checkbox" checked={c.on} onChange={(e) => set(i, { on: e.target.checked })} /> On</label>
            </div>
            {c.slots.map((s, k) => (
              <div key={k} className="row small" style={{ alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                <b>{k + 1}.</b>
                <input className="input" style={{ maxWidth: "11rem" }} maxLength={40} value={s.label} onChange={(e) => setSlot(i, k, { label: e.target.value })} aria-label={`Part ${k + 1} label`} />
                {CATS.map((cat) => {
                  const on = !!s.cats?.includes(cat.id);
                  return <button key={cat.id} type="button" className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => setSlot(i, k, { cats: on ? (s.cats ?? []).filter((x) => x !== cat.id) : [...(s.cats ?? []), cat.id], items: [] })}>{cat.label}</button>;
                })}
                {c.slots.length > 2 && <button className="link-btn small" onClick={() => set(i, { slots: c.slots.filter((_, j) => j !== k) })}>Remove</button>}
              </div>
            ))}
            <div className="row small" style={{ alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              {c.slots.length < 4 && <button className="link-btn small" onClick={() => set(i, { slots: [...c.slots, { label: "Any cold drink", cats: ["cold"] }] })}>+ another part</button>}
              <label className="row" style={{ gap: "0.3rem", alignItems: "center" }}><input type="checkbox" checked={c.from !== undefined} onChange={(e) => set(i, e.target.checked ? { from: 7, to: 11 } : { from: undefined, to: undefined })} /> Only between</label>
              {c.from !== undefined && <>
                <select className="input" style={{ width: "auto" }} value={c.from} onChange={(e) => set(i, { from: Number(e.target.value) })} aria-label="Starts">{HOURS.slice(0, 24).map((h) => <option key={h} value={h}>{hourText(h)}</option>)}</select>
                and
                <select className="input" style={{ width: "auto" }} value={c.to} onChange={(e) => set(i, { to: Number(e.target.value) })} aria-label="Ends">{HOURS.slice(1).map((h) => <option key={h} value={h}>{hourText(h)}</option>)}</select>
              </>}
              <button className="link-btn small" onClick={() => setList(list.filter((_, j) => j !== i))}>Delete combo</button>
            </div>
            {low < 9999 && c.price >= low && <p className="tiny cashup-bad">At ₹{c.price} it only saves money on pricier picks: the cheapest combination costs ₹{low}.</p>}
          </div>
        );
      })}
      {JSON.stringify(list) !== saved && <button className="btn btn-pink btn-sm" style={{ marginTop: "0.6rem" }} onClick={save}>Save combos</button>}
    </section>
  );
}
