"use client";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { CATEGORIES, inTab, photo, type Addon, type Category, type Diet, type MenuItem, type MenuTab } from "@/lib/menu";
import { rupees } from "@/lib/pricing";
import { SEASONS } from "@/lib/seasons";
import { ALLERGENS, type Allergen } from "@/lib/nutrition";
import { useStore } from "../Store";
import { activeBranches } from "@/lib/cafe";

const send = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const BLANK: MenuItem = { id: "", cat: "coffee", name: "", desc: "", price: 200, img: "", traits: { energy: 1, sweet: 1, temp: "hot" } };
const LEVELS = ["Low", "Medium", "High"];

// Staff: add, edit, hide, reorder and stock menu items. Changes go live instantly.
export default function MenuEditor({ canEdit = true }: { canEdit?: boolean }) {
  const { toast, refreshSoldOut } = useStore();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [filter, setFilter] = useState<MenuTab>("all");
  const [editing, setEditing] = useState<MenuItem | null>(null);

  const load = useCallback(async () => {
    const d = await fetch("/api/menu?all=1").then((r) => r.json());
    if (Array.isArray(d.items)) setItems(d.items);
    refreshSoldOut();
  }, [refreshSoldOut]);
  useEffect(() => { load(); }, [load]);

  async function stock(m: MenuItem) {
    await fetch("/api/menu", send("PATCH", { itemId: m.id, soldOut: !m.soldOut }));
    toast(m.soldOut ? `${m.name} is back ✿` : `${m.name} marked sold out`);
    load();
  }
  async function toggleHidden(m: MenuItem) {
    await fetch("/api/menu", send("POST", { ...m, hidden: !m.hidden }));
    toast(m.hidden ? `${m.name} is on the menu again` : `${m.name} hidden from guests`);
    load();
  }
  async function move(m: MenuItem, dir: "up" | "down") {
    await fetch("/api/menu", send("POST", { move: dir, id: m.id }));
    load();
  }

  const shown = items.filter((m) => inTab(m, filter));

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div className="chips" style={{ justifyContent: "flex-start" }}>
          {CATEGORIES.map((c) => (
            <button key={c.id} className={`chip ${filter === c.id ? "on" : ""}`} onClick={() => setFilter(c.id)}>{c.label}</button>
          ))}
        </div>
        {canEdit && <button className="btn btn-pink btn-sm" onClick={() => setEditing({ ...BLANK, cat: filter === "all" || filter === "specials" || filter === "kids" ? "coffee" : filter, ...(filter === "kids" ? { kids: true } : {}) })}>＋ New item</button>}
      </div>
      <p className="muted small" style={{ marginBottom: "1rem" }}>{canEdit ? <>Changes show on the site straight away. &quot;Hidden&quot; keeps an item for later; seasonal items appear and disappear on their dates.</> : "Flip the switch when something runs out. It shows as sold out straight away."}</p>

      <div className="menu-admin">
        {shown.map((m) => (
          <div key={m.id} className={`menu-row card ${m.hidden ? "is-hidden" : ""}`}>
            <div className="menu-row-ph"><Image src={photo(m.img, 200)} alt="" fill sizes="64px" /></div>
            <div className="menu-row-info">
              <strong>{m.name}</strong>
              <small className="muted">{rupees(m.price)} · {m.cat}{m.badge ? ` · ${m.badge}` : ""}{m.hidden ? " · hidden" : ""}</small>
            </div>
            <label className="small muted stock-toggle">
              <button className={`switch ${m.soldOut ? "off" : ""}`} onClick={() => stock(m)} aria-label={`${m.name} in stock`} aria-pressed={!m.soldOut} />
              {m.soldOut ? "sold out" : "in stock"}
            </label>
            {canEdit && <div className="menu-row-actions">
              <button className="chip" onClick={() => move(m, "up")} aria-label="Move up">↑</button>
              <button className="chip" onClick={() => move(m, "down")} aria-label="Move down">↓</button>
              <button className="chip" onClick={() => toggleHidden(m)}>{m.hidden ? "Show" : "Hide"}</button>
              <button className="chip on" onClick={() => setEditing(m)}>Edit</button>
              <a className="chip" href={`/api/admin/story?item=${encodeURIComponent(m.id)}`} target="_blank" title="Instagram story image" aria-label={`Instagram story image for ${m.name}`}>📸</a>
            </div>}
          </div>
        ))}
      </div>

      {editing && <ItemForm item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </>
  );
}

function ItemForm({ item, onClose, onSaved }: { item: MenuItem; onClose: () => void; onSaved: () => void }) {
  const { toast } = useStore();
  const [f, setF] = useState<MenuItem>({ ...item, traits: item.traits ?? { energy: 1, sweet: 1, temp: "hot" } });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const isNew = !item.id;
  const set = <K extends keyof MenuItem>(k: K, v: MenuItem[K]) => setF((x) => ({ ...x, [k]: v }));
  const [writing, setWriting] = useState(false);
  const [notes, setNotes] = useState("");
  // AI first draft: description, allergens, calories, vegan/GF and the Hindi text. The owner checks it before saving.
  async function write() {
    setWriting(true);
    const r = await fetch("/api/admin/menu-writer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.name, cat: f.cat, notes }) });
    const d = await r.json();
    setWriting(false);
    if (!r.ok) return toast(d.error);
    setF((x) => ({ ...x, desc: d.desc || x.desc, allergens: d.allergens, kcal: d.kcal || x.kcal, diet: d.diet, nameHi: d.nameHi, descHi: d.descHi }));
    toast("Drafted ✿ Check the allergens and calories before saving");
  }
  const toggleDiet = (d: Diet) => set("diet", f.diet?.includes(d) ? f.diet.filter((x) => x !== d) : [...(f.diet ?? []), d]);

  async function upload(file: File) {
    setUploading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const d = await r.json();
    setUploading(false);
    if (!r.ok) return setError(d.error);
    set("img", d.url);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch("/api/menu", send("POST", { ...f, id: isNew ? undefined : f.id }));
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setError(d.error);
    toast(isNew ? `${f.name} added to the menu ✿` : "Saved ✿");
    onSaved();
  }

  async function remove() {
    setBusy(true);
    await fetch(`/api/menu?id=${encodeURIComponent(f.id)}`, { method: "DELETE" });
    toast(`${f.name} deleted`);
    onSaved();
  }

  const [confirmDelete, setConfirmDelete] = useState(false);
  const drink = f.cat === "coffee" || f.cat === "tea" || f.cat === "cold";

  return (
    <>
      <div className="overlay show" onClick={onClose} />
      <form className="modal card" onSubmit={save} role="dialog" aria-modal="true" aria-label={isNew ? "New menu item" : `Edit ${item.name}`}>
        <div className="modal-photo" style={{ height: 180, background: "var(--surface-2)" }}>
          {f.img ? <Image src={photo(f.img, 800)} alt="" fill sizes="520px" /> : <span className="muted" style={{ display: "grid", placeItems: "center", height: "100%" }}>No photo yet</span>}
          <button type="button" className="icon-btn close-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          <h3 style={{ fontSize: "1.8rem" }}>{isNew ? "New menu item" : "Edit item"}</h3>
          <div className="row">
            <label className="field">Name<input className="input" required maxLength={60} value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
            <label className="field" style={{ maxWidth: "8rem" }}>Price (₹)<input className="input" required inputMode="numeric" value={f.price} onChange={(e) => set("price", Number(e.target.value.replace(/\D/g, "")) || 0)} /></label>
          </div>
          <label className="field">Description<textarea className="input" rows={2} maxLength={200} value={f.desc} onChange={(e) => set("desc", e.target.value)} /></label>
          <div className="ai-writer">
            <input className="input" placeholder="What's in it? (optional, helps the AI: e.g. oat milk, cardamom, honey)" aria-label="Notes for the AI" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <button type="button" className="btn btn-ghost btn-sm" disabled={writing || !f.name.trim()} onClick={write}>{writing ? "Writing…" : "✨ Write it for me"}</button>
          </div>
          <div className="row">
            <label className="field" lang="hi">Name in Hindi <span className="muted small">· optional</span><input className="input" maxLength={60} value={f.nameHi ?? ""} onChange={(e) => set("nameHi", e.target.value || undefined)} /></label>
            <label className="field" lang="hi">Description in Hindi<input className="input" maxLength={200} value={f.descHi ?? ""} onChange={(e) => set("descHi", e.target.value || undefined)} /></label>
          </div>
          <div className="row">
            <label className="field">Category
              <select className="input" value={f.cat} onChange={(e) => set("cat", e.target.value as Category)}>
                <option value="coffee">Coffee</option><option value="tea">Tea & matcha</option><option value="cold">Cold drinks</option><option value="food">Food</option><option value="shop">Shop (beans, merch)</option><option value="bakes">Bakes & sweets</option>
              </select>
            </label>
            <label className="field">Badge
              <select className="input" value={f.badge ?? ""} onChange={(e) => set("badge", (e.target.value || undefined) as MenuItem["badge"])}>
                <option value="">None</option><option value="bestseller">Bestseller</option><option value="new">New</option><option value="pink pick">Pink pick</option>
              </select>
            </label>
          </div>
          <div className="field">Dietary
            <div className="chips" style={{ justifyContent: "flex-start" }}>
              <button type="button" className={`chip ${f.diet?.includes("vegan") ? "on" : ""}`} onClick={() => toggleDiet("vegan")}>🌱 Vegan</button>
              <button type="button" className={`chip ${f.diet?.includes("gf") ? "on" : ""}`} onClick={() => toggleDiet("gf")}>🌾 Gluten-free</button>
            </div>
          </div>
          {activeBranches().length > 1 && (
            <div className="field">Sold at <span className="muted small">· none picked = every branch</span>
              <div className="chips" style={{ justifyContent: "flex-start" }}>
                {activeBranches().map((br) => {
                  const on = !!f.branches?.includes(br.id);
                  return <button type="button" key={br.id} aria-pressed={on} className={`chip ${on ? "on" : ""}`} onClick={() => set("branches", on ? (f.branches ?? []).filter((x) => x !== br.id) : [...(f.branches ?? []), br.id])}>{br.name}</button>;
                })}
              </div>
            </div>
          )}
          <div className="field">Photo
            <div className="row" style={{ alignItems: "center" }}>
              <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
                {uploading ? "Uploading…" : "⬆ Upload photo"}
                <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              </label>
              <span className="small muted">or paste an Unsplash image link:</span>
            </div>
            <input className="input" placeholder="https://images.unsplash.com/photo-…" value={f.img} onChange={(e) => set("img", e.target.value)} />
          </div>
          {drink && (
            <div className="field">For the &quot;find your drink&quot; quiz &amp; barista
              <div className="row">
                <select className="input" value={f.traits!.energy} onChange={(e) => set("traits", { ...f.traits!, energy: Number(e.target.value) as 0 | 1 | 2 })} aria-label="Caffeine">
                  {LEVELS.map((l, i) => <option key={l} value={i}>{l} caffeine</option>)}
                </select>
                <select className="input" value={f.traits!.sweet} onChange={(e) => set("traits", { ...f.traits!, sweet: Number(e.target.value) as 0 | 1 | 2 })} aria-label="Sweetness">
                  {LEVELS.map((l, i) => <option key={l} value={i}>{l} sweetness</option>)}
                </select>
                <select className="input" value={f.traits!.temp} onChange={(e) => set("traits", { ...f.traits!, temp: e.target.value as "hot" | "iced" })} aria-label="Served">
                  <option value="hot">Served hot</option><option value="iced">Served iced</option>
                </select>
              </div>
            </div>
          )}
          <div className="field">Seasonal (optional): only on the menu between these dates
            <div className="row">
              <input className="input" type="date" value={f.from ?? ""} onChange={(e) => set("from", e.target.value || undefined)} aria-label="Season starts" />
              <input className="input" type="date" value={f.until ?? ""} onChange={(e) => set("until", e.target.value || undefined)} aria-label="Season ends" />
            </div>
          </div>
          <div className="field">Allergens in the item itself {f.cat !== "bakes" ? "(milk is added automatically from the milk the guest picks)" : ""}
            <div className="chips" style={{ justifyContent: "flex-start" }}>
              {ALLERGENS.map((a) => {
                const on = (f.allergens ?? []).includes(a.id);
                return (
                  <button type="button" key={a.id} className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => set("allergens", on ? (f.allergens ?? []).filter((x) => x !== a.id) : [...(f.allergens ?? []), a.id as Allergen])}>
                    {a.icon} {a.label}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="field">Calories (optional, regular size as it usually comes)
            <input className="input" type="number" min={0} max={3000} value={f.kcal ?? ""} onChange={(e) => set("kcal", e.target.value === "" ? undefined : Number(e.target.value))} placeholder="e.g. 190" />
          </label>
          <label className="field">Cost to make (optional, ₹){f.cat === "bakes" ? ": what one costs you to bake or buy" : ": anything not tracked in Stock (syrups, cream…)"}
            <input className="input" type="number" min={0} step="0.5" value={f.cost ?? ""} onChange={(e) => set("cost", e.target.value === "" ? undefined : Number(e.target.value))} placeholder={f.cat === "bakes" ? "e.g. 45" : "e.g. 12"} />
          </label>
          <label className="field">Festival special (optional): only on the menu during
            <select className="input" value={f.season ?? ""} onChange={(e) => set("season", e.target.value || undefined)}>
              <option value="">Every season</option>
              {Object.values(SEASONS).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          {f.cat === "shop" ? (
            <>
              <label className="field">How many in stock (leave empty to not count)
                <input className="input" type="number" min={0} max={9999} value={f.stock ?? ""} onChange={(e) => set("stock", e.target.value === "" ? undefined : Number(e.target.value))} placeholder="e.g. 30" />
              </label>
              <VariantsEditor variants={f.variants ?? []} onChange={(v) => set("variants", v.length ? v : undefined)} />
            </>
          ) : drink ? (
            <div className="toggle-row">
              <span>Made without milk <span className="small muted">· smoothies, juices, mocktails: hides the milk, syrup and topping choices</span></span>
              <button type="button" className={`switch ${f.noMilk ? "" : "off"}`} onClick={() => set("noMilk", f.noMilk ? undefined : true)} aria-pressed={!!f.noMilk} aria-label="Made without milk" />
            </div>
          ) : (
            <AddonsEditor addons={f.addons ?? []} onChange={(a) => set("addons", a.length ? a : undefined)} />
          )}
          <UsesEditor uses={f.uses ?? []} onChange={(u) => set("uses", u)} />
          {error && <p className="error">{error}</p>}
          <div className="row" style={{ justifyContent: "space-between" }}>
            {!isNew && (confirmDelete ? (
              <span className="row" style={{ alignItems: "center" }}>
                <span className="small">Delete for good?</span>
                <button type="button" className="chip" onClick={remove} disabled={busy}>Yes, delete</button>
                <button type="button" className="chip" onClick={() => setConfirmDelete(false)}>No</button>
              </span>
            ) : (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(true)}>Delete</button>
            ))}
            <button className="btn btn-pink" disabled={busy || uploading} style={{ marginLeft: "auto" }}>{busy ? "Saving…" : isNew ? "Add to menu" : "Save changes"}</button>
          </div>
        </div>
      </form>
    </>
  );
}

/** Which ingredients one of this item uses (empty = sensible defaults for drinks) */
function UsesEditor({ uses, onChange }: { uses: { ingredient: string; amount: number }[]; onChange: (u: { ingredient: string; amount: number }[]) => void }) {
  const [list, setList] = useState<{ id: string; name: string; unit: string }[]>([]);
  useEffect(() => {
    fetch("/api/admin/stock").then((r) => (r.ok ? r.json() : [])).then(setList).catch(() => {});
  }, []);
  const opts = [{ id: "milk", name: "Milk (follows the guest's choice)", unit: "ml" }, ...list];
  return (
    <div className="field">Uses <span className="small">(leave empty for our usual recipe)</span>
      {uses.map((u, i) => (
        <div className="row" key={i}>
          <select className="input" value={u.ingredient} onChange={(e) => onChange(uses.map((x, j) => (j === i ? { ...x, ingredient: e.target.value } : x)))} aria-label="Ingredient">
            {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <input className="input" style={{ maxWidth: "6rem" }} inputMode="decimal" value={u.amount} onChange={(e) => onChange(uses.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) || 0 } : x)))} aria-label="Amount" />
          <span className="small muted" style={{ alignSelf: "center" }}>{opts.find((o) => o.id === u.ingredient)?.unit ?? ""}</span>
          <button type="button" className="chip" onClick={() => onChange(uses.filter((_, j) => j !== i))} aria-label="Remove ingredient">✕</button>
        </div>
      ))}
      <button type="button" className="chip" style={{ alignSelf: "flex-start" }} onClick={() => onChange([...uses, { ingredient: opts[1]?.id ?? "milk", amount: 1 }])}>＋ Add ingredient</button>
    </div>
  );
}


/** Food add-ons: label, price, and allergens it adds (e.g. an egg) or takes away (gluten-free bread) */
function AddonsEditor({ addons, onChange }: { addons: Addon[]; onChange: (a: Addon[]) => void }) {
  const upd = (i: number, patch: Partial<Addon>) => onChange(addons.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const ALLERGEN_IDS = ["milk", "nuts", "gluten", "egg", "soy", "sesame"];
  return (
    <div className="field">Add-ons <span className="small">(extra cheese, add an egg, make it a combo…)</span>
      {addons.map((a, i) => (
        <div className="row" key={a.id} style={{ alignItems: "center" }}>
          <input className="input" style={{ flex: 2, minWidth: 140 }} value={a.label} maxLength={50} onChange={(e) => upd(i, { label: e.target.value })} aria-label="Add-on name" />
          <input className="input" style={{ maxWidth: "5.5rem" }} type="number" min={0} max={2000} value={a.price} onChange={(e) => upd(i, { price: Math.max(0, Number(e.target.value) || 0) })} aria-label="Add-on price" />
          <select className="input" style={{ maxWidth: "9rem" }} value={a.removes?.[0] ? `-${a.removes[0]}` : a.adds?.[0] ? `+${a.adds[0]}` : ""} onChange={(e) => {
            const v = e.target.value;
            upd(i, { adds: v.startsWith("+") ? [v.slice(1)] : undefined, removes: v.startsWith("-") ? [v.slice(1)] : undefined });
          }} aria-label="Allergen change">
            <option value="">No allergen change</option>
            {ALLERGEN_IDS.map((x) => <option key={`+${x}`} value={`+${x}`}>Adds {x}</option>)}
            {ALLERGEN_IDS.map((x) => <option key={`-${x}`} value={`-${x}`}>Removes {x}</option>)}
          </select>
          <button type="button" className="chip" onClick={() => onChange(addons.filter((_, j) => j !== i))} aria-label={`Remove ${a.label}`}>✕</button>
        </div>
      ))}
      <button type="button" className="chip" style={{ alignSelf: "flex-start" }} onClick={() => onChange([...addons, { id: `addon-${Math.random().toString(36).slice(2, 7)}`, label: "New add-on", price: 30 }])}>＋ Add an add-on</button>
    </div>
  );
}

/** Shop items: one choice from a list, e.g. grind or colour, each with an optional extra price */
function VariantsEditor({ variants, onChange }: { variants: { id: string; label: string; price: number }[]; onChange: (v: { id: string; label: string; price: number }[]) => void }) {
  const upd = (i: number, patch: Partial<{ label: string; price: number }>) => onChange(variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  return (
    <div className="field">Choices <span className="small">(e.g. grind or colour; the first is the default)</span>
      {variants.map((v, i) => (
        <div className="row" key={v.id} style={{ alignItems: "center" }}>
          <input className="input" style={{ flex: 2, minWidth: 140 }} value={v.label} maxLength={50} onChange={(e) => upd(i, { label: e.target.value })} aria-label="Choice name" />
          <input className="input" style={{ maxWidth: "6rem" }} type="number" min={0} value={v.price} onChange={(e) => upd(i, { price: Math.max(0, Number(e.target.value) || 0) })} aria-label="Extra price" />
          <button type="button" className="chip" onClick={() => onChange(variants.filter((_, j) => j !== i))} aria-label={`Remove ${v.label}`}>✕</button>
        </div>
      ))}
      <button type="button" className="chip" style={{ alignSelf: "flex-start" }} onClick={() => onChange([...variants, { id: `opt-${Math.random().toString(36).slice(2, 7)}`, label: "New choice", price: 0 }])}>＋ Add a choice</button>
    </div>
  );
}
