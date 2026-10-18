"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";
import { DELIVERY, type DeliveryZone } from "@/lib/pricing";
import { rupees } from "@/lib/pricing";

type Z = Omit<DeliveryZone, "pincodes"> & { pincodes: string };
const blank = (): Z => ({ id: "", name: "", pincodes: "", fee: 40, freeOver: 600, minOrder: 200, minutes: 25 });

/** Owner, Settings: where you deliver, by pincode, each area with its own fee, minimum and time */
export default function DeliveryZonesCard() {
  const { toast } = useStore();
  const [list, setList] = useState<Z[] | null>(null);
  const [saved, setSaved] = useState("");
  const toZ = (zs: DeliveryZone[]) => zs.map((z) => ({ ...z, pincodes: z.pincodes.join(", ") }));
  useEffect(() => { fetch("/api/admin/cafe-config").then((r) => r.json()).then((d) => { const z = toZ(d.zones ?? []); setList(z); setSaved(JSON.stringify(z)); }).catch(() => {}); }, []);
  if (!list) return null;
  const set = (i: number, patch: Partial<Z>) => setList(list.map((z, j) => (j === i ? { ...z, ...patch } : z)));
  async function save() {
    const r = await fetch("/api/admin/cafe-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ zones: list }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    const z = toZ(d.zones);
    setList(z);
    setSaved(JSON.stringify(z));
    toast("Delivery areas saved ✿");
  }
  const num = (v: string) => Number(v.replace(/\D/g, "")) || 0;
  return (
    <section className="card" style={{ padding: "1.1rem 1.2rem" }}>
      <div className="sum-row" style={{ alignItems: "center" }}>
        <h3 style={{ fontSize: "1.2rem" }}>🛵 Delivery areas</h3>
        {list.length < 12 && <button className="btn btn-ghost btn-sm" onClick={() => setList([...list, blank()])}>Add an area</button>}
      </div>
      <p className="small muted">{list.length ? "Guests enter their pincode at checkout; only these areas can order delivery." : `No areas yet: anyone can ask for delivery on the standard terms (${rupees(DELIVERY.fee)}, free over ${rupees(DELIVERY.freeOver)}, minimum ${rupees(DELIVERY.minOrder)}). Add areas to limit it by pincode.`}</p>
      {list.map((z, i) => (
        <div key={z.id || `new-${i}`} className="branch-row">
          <div className="row">
            <label className="field">Area name<input className="input" maxLength={40} value={z.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="e.g. Panjim" /></label>
            <label className="field">Pincodes <span className="muted small">· comma separated</span><input className="input" inputMode="numeric" value={z.pincodes} onChange={(e) => set(i, { pincodes: e.target.value.replace(/[^\d,\s]/g, "") })} placeholder="403001, 403002" /></label>
          </div>
          <div className="row">
            <label className="field">Fee ₹<input className="input" inputMode="numeric" value={z.fee} onChange={(e) => set(i, { fee: num(e.target.value) })} /></label>
            <label className="field">Free over ₹<input className="input" inputMode="numeric" value={z.freeOver} onChange={(e) => set(i, { freeOver: num(e.target.value) })} /></label>
            <label className="field">Minimum ₹<input className="input" inputMode="numeric" value={z.minOrder} onChange={(e) => set(i, { minOrder: num(e.target.value) })} /></label>
            <label className="field">Minutes<input className="input" inputMode="numeric" value={z.minutes} onChange={(e) => set(i, { minutes: num(e.target.value) })} /></label>
          </div>
          <button className="link-btn small" style={{ alignSelf: "flex-start" }} onClick={() => setList(list.filter((_, j) => j !== i))}>Remove area</button>
        </div>
      ))}
      {JSON.stringify(list) !== saved && <button className="btn btn-pink btn-sm" style={{ marginTop: "0.6rem" }} onClick={save}>Save delivery areas</button>}
    </section>
  );
}
