"use client";
import { useEffect, useMemo, useState } from "react";
import { useEscape, useStore } from "./Store";
import { isDrink } from "@/lib/pricing";

type Data = { recipes: Record<string, string>; sizeGuide: string };
let cache: Data | null = null;

/** Staff: how to make each drink. Open on one item (from a ticket) or browse them all. */
export default function RecipeBook({ itemId, note, onClose }: { itemId: string | null; note?: string; onClose: () => void }) {
  const { menu, find, toast } = useStore();
  const [d, setD] = useState<Data | null>(cache);
  const [pick, setPick] = useState<string | null>(itemId);
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState(false);
  const [edit, setEdit] = useState<string | null>(null);
  useEscape(true, onClose);
  useEffect(() => { setPick(itemId); }, [itemId]);
  useEffect(() => {
    fetch("/api/admin/recipes").then((r) => r.json()).then((x) => { cache = x; setD(x); }).catch(() => {});
    fetch("/api/admin/me").then((r) => r.json()).then((m) => setOwner(m.role === "owner")).catch(() => {});
  }, []);
  const drinks = useMemo(() => menu.filter((m) => isDrink(m.cat) && (!q || m.name.toLowerCase().includes(q.toLowerCase()))), [menu, q]);
  const item = pick ? find(pick) : null;

  async function save() {
    const r = await fetch("/api/admin/recipes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: pick, text: edit }) });
    const x = await r.json();
    if (!r.ok) return toast(x.error);
    cache = { ...d!, recipes: x.recipes };
    setD(cache);
    setEdit(null);
    toast("Recipe saved ✓");
  }

  return (
    <>
      <div className="overlay show" onClick={onClose} />
      <div className="modal card recipe-modal" role="dialog" aria-modal="true" aria-label="Recipes">
        <div className="modal-body">
          <div className="sum-row" style={{ alignItems: "center" }}>
            <h3 style={{ fontSize: "1.5rem" }}>{item ? `📖 ${item.name}` : "📖 Recipes"}</h3>
            <span className="row" style={{ gap: "0.4rem" }}>
              {item && <button className="link-btn" onClick={() => { setPick(null); setEdit(null); }}>All recipes</button>}
              <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
            </span>
          </div>
          {!d ? <p className="muted">Loading…</p> : item ? (
            <>
              {note && <p className="reward-banner small">This order: <b>{note}</b></p>}
              {edit !== null ? (
                <>
                  <textarea className="input" rows={8} value={edit} onChange={(e) => setEdit(e.target.value)} aria-label="Recipe steps, one per line" />
                  <div className="row"><button className="btn btn-pink btn-sm" onClick={save}>Save</button><button className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancel</button></div>
                </>
              ) : d.recipes[item.id] ? (
                <ol className="recipe-steps">{d.recipes[item.id].split("\n").filter(Boolean).map((s, i) => <li key={i}>{s}</li>)}</ol>
              ) : <p className="muted">No recipe yet.{owner ? " Add one below." : " Ask the owner to add one."}</p>}
              {owner && edit === null && <button className="btn btn-ghost btn-sm" onClick={() => setEdit(d.recipes[item.id] ?? "")}>{d.recipes[item.id] ? "Edit recipe" : "Add recipe"}</button>}
              <p className="tiny muted" style={{ marginTop: "0.8rem" }}>{d.sizeGuide}</p>
            </>
          ) : (
            <>
              <input className="input" placeholder="Find a drink" aria-label="Find a drink" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
              <div className="recipe-list">
                {drinks.map((m) => <button key={m.id} className="support-row" onClick={() => setPick(m.id)}><b>{m.name}</b><small className="muted">{d.recipes[m.id] ? d.recipes[m.id].split("\n")[0].slice(0, 70) : "no recipe yet"}</small></button>)}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
