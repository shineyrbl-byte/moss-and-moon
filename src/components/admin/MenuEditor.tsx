"use client";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { CATEGORIES, photo, type Category, type Diet, type MenuItem } from "@/lib/menu";
import { rupees } from "@/lib/pricing";
import { useStore } from "../Store";

const send = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const BLANK: MenuItem = { id: "", cat: "coffee", name: "", desc: "", price: 200, img: "", traits: { energy: 1, sweet: 1, temp: "hot" } };
const LEVELS = ["Low", "Medium", "High"];

// Staff: add, edit, hide, reorder and stock menu items. Changes go live instantly.
export default function MenuEditor() {
  const { toast, refreshSoldOut } = useStore();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [filter, setFilter] = useState<Category | "all">("all");
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

  const shown = items.filter((m) => filter === "all" || m.cat === filter);

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div className="chips" style={{ justifyContent: "flex-start" }}>
          {CATEGORIES.map((c) => (
            <button key={c.id} className={`chip ${filter === c.id ? "on" : ""}`} onClick={() => setFilter(c.id)}>{c.label}</button>
          ))}
        </div>
        <button className="btn btn-pink btn-sm" onClick={() => setEditing({ ...BLANK, cat: filter === "all" ? "coffee" : filter })}>＋ New item</button>
      </div>
      <p className="muted small" style={{ marginBottom: "1rem" }}>Changes show on the site straight away. &quot;Hidden&quot; keeps an item for later without guests seeing it.</p>

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
            <div className="menu-row-actions">
              <button className="chip" onClick={() => move(m, "up")} aria-label="Move up">↑</button>
              <button className="chip" onClick={() => move(m, "down")} aria-label="Move down">↓</button>
              <button className="chip" onClick={() => toggleHidden(m)}>{m.hidden ? "Show" : "Hide"}</button>
              <button className="chip on" onClick={() => setEditing(m)}>Edit</button>
            </div>
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
  const drink = f.cat !== "bakes";

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
          <div className="row">
            <label className="field">Category
              <select className="input" value={f.cat} onChange={(e) => set("cat", e.target.value as Category)}>
                <option value="coffee">Coffee</option><option value="tea">Tea & matcha</option><option value="bakes">Bakes & sweets</option>
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
