"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";
import { hourText, type Branch, type DayHours } from "@/lib/cafe";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const HOURS = Array.from({ length: 25 }, (_, i) => i);

/** Owner: the café's locations. Each extra branch can have its own hours; stock and menu are shared. */
export default function BranchesCard() {
  const { toast } = useStore();
  const [list, setList] = useState<Branch[] | null>(null);
  const [mainHours, setMainHours] = useState<Record<number, DayHours>>({});
  const [saved, setSaved] = useState("");
  useEffect(() => {
    fetch("/api/admin/cafe-config").then((r) => r.json()).then((d) => { setList(d.branches); setMainHours(d.hours); setSaved(JSON.stringify(d.branches)); }).catch(() => {});
  }, []);
  if (!list) return null;
  const dirty = JSON.stringify(list) !== saved;
  const set = (i: number, patch: Partial<Branch>) => setList((l) => l!.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const setDay = (i: number, d: number, v: DayHours) => setList((l) => l!.map((b, j) => (j === i ? { ...b, hours: { ...(b.hours ?? mainHours), [d]: v } } : b)));

  async function save() {
    const r = await fetch("/api/admin/cafe-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ branches: list }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setList(d.branches);
    setSaved(JSON.stringify(d.branches));
    toast("Branches saved. Reload the site to see them ✿");
  }

  return (
    <section className="card" style={{ padding: "1.1rem 1.2rem", marginTop: "1.2rem" }}>
      <div className="sum-row" style={{ alignItems: "center" }}>
        <h3 style={{ fontSize: "1.2rem" }}>🏠 Branches</h3>
        {list.length < 4 && <button className="btn btn-ghost btn-sm" onClick={() => setList([...list, { id: "", name: "", address: "", hours: null, active: true }])}>Add a branch</button>}
      </div>
      <p className="small muted">With two or more, guests pick a café when they order or book, and staff screens can show one branch. Holidays, menu and stock are shared; hide an item at a branch from the Menu tab.</p>
      {list.map((b, i) => (
        <div key={b.id || `new-${i}`} className="branch-row">
          <div className="row">
            <label className="field">Name<input className="input" value={b.name} maxLength={40} onChange={(e) => set(i, { name: e.target.value })} placeholder="e.g. Fontainhas" /></label>
            <label className="field">Address<input className="input" value={b.address} maxLength={120} onChange={(e) => set(i, { address: e.target.value })} /></label>
          </div>
          {b.id === "main" ? <p className="tiny muted">The main café. Its hours are set above.</p> : (
            <>
              <div className="row small" style={{ alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <label className="row" style={{ gap: "0.35rem", alignItems: "center" }}><input type="checkbox" checked={b.active} onChange={(e) => set(i, { active: e.target.checked })} /> Open to guests</label>
                <label className="row" style={{ gap: "0.35rem", alignItems: "center" }}><input type="checkbox" checked={!!b.hours} onChange={(e) => set(i, { hours: e.target.checked ? { ...mainHours } : null })} /> Its own opening hours</label>
                {b.id && <button className="link-btn small" onClick={() => setList(list.filter((_, j) => j !== i))}>Remove</button>}
                {!b.id && <button className="link-btn small" onClick={() => setList(list.filter((_, j) => j !== i))}>Cancel</button>}
              </div>
              {b.hours && (
                <div className="branch-hours">
                  {ORDER.map((d) => {
                    const h = b.hours![d];
                    return (
                      <div key={d} className="row small" style={{ alignItems: "center", gap: "0.4rem" }}>
                        <b style={{ width: "2.5rem" }}>{DAYS[d]}</b>
                        <label className="row" style={{ gap: "0.25rem", alignItems: "center" }}><input type="checkbox" checked={!!h} onChange={(e) => setDay(i, d, e.target.checked ? [8, 20] : null)} /> open</label>
                        {h && <>
                          <select className="input" style={{ width: "auto" }} aria-label={`${DAYS[d]} opens`} value={h[0]} onChange={(e) => setDay(i, d, [Number(e.target.value), h[1]])}>{HOURS.slice(0, 24).map((x) => <option key={x} value={x}>{hourText(x)}</option>)}</select>
                          –
                          <select className="input" style={{ width: "auto" }} aria-label={`${DAYS[d]} closes`} value={h[1]} onChange={(e) => setDay(i, d, [h[0], Number(e.target.value)])}>{HOURS.slice(1).map((x) => <option key={x} value={x}>{hourText(x)}</option>)}</select>
                        </>}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      ))}
      {dirty && <button className="btn btn-pink btn-sm" style={{ marginTop: "0.6rem" }} onClick={save}>Save branches</button>}
    </section>
  );
}
