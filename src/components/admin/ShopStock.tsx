"use client";
import { useStore } from "../Store";

/** Staff: how many of each shop item are left (sells out by itself at 0) */
export default function ShopStock() {
  const { menu, toast, refreshSoldOut } = useStore();
  const items = menu.filter((m) => m.cat === "shop" && m.stock !== undefined);
  if (!items.length) return null;
  async function setStock(id: string, stock: number) {
    const r = await fetch("/api/menu", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: id, stock }) });
    if (!r.ok) return toast((await r.json()).error);
    refreshSoldOut();
  }
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "1.2rem" }}>🛍 Shop stock</h3>
      <div className="waste-grid">
        {items.map((m) => (
          <div key={m.id} className="waste-item">
            <span className="small">{m.name}{m.stock! <= 3 ? <b style={{ color: "var(--pink-ink)" }}> · {m.stock === 0 ? "sold out" : "low"}</b> : null}</span>
            <div className="stepper">
              <button onClick={() => setStock(m.id, Math.max(0, m.stock! - 1))} aria-label={`One less ${m.name}`}>−</button>
              <strong>{m.stock}</strong>
              <button onClick={() => setStock(m.id, m.stock! + 1)} aria-label={`One more ${m.name}`}>+</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
