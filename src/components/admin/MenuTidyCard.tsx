"use client";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "../Store";
import { rupees } from "@/lib/pricing";
import type { MenuItem } from "@/lib/menu";

type Sold = { name: string; qty: number; revenue: number; cost: number };
const DAYS = 30;

/** Owner, Menu tab: slow sellers with thin margins that could come off, to keep the menu easy to choose from */
export default function MenuTidyCard() {
  const { menu, toast } = useStore();
  const [sold, setSold] = useState<Sold[] | null>(null);
  const [orders, setOrders] = useState(0);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => {
    fetch(`/api/admin/profit?days=${DAYS}`).then((r) => r.json()).then((d) => { setSold(d.items); setOrders(d.daily.reduce((s: number, x: { revenue: number }) => s + (x.revenue > 0 ? 1 : 0), 0)); }).catch(() => {});
  }, []);
  const ideas = useMemo(() => {
    if (!sold) return [];
    const by = new Map(sold.map((s) => [s.name, s]));
    const eligible = menu.filter((m) => m.cat !== "shop" && !m.badge && !m.rotation && !m.staffPick && !m.season && !m.id.startsWith("special-"));
    const rows = eligible.map((m) => { const s = by.get(m.name); return { m, qty: s?.qty ?? 0, margin: s && s.qty ? (s.revenue - s.cost) / s.qty : 0 }; });
    const qtys = rows.map((r) => r.qty).sort((a, b) => a - b);
    const slow = qtys[Math.floor(qtys.length * 0.15)] ?? 0; // the slowest 15%
    const avgMargin = rows.filter((r) => r.qty).reduce((s, r) => s + r.margin, 0) / Math.max(1, rows.filter((r) => r.qty).length);
    return rows.filter((r) => r.qty <= slow && (r.qty === 0 || r.margin < avgMargin)).sort((a, b) => a.qty - b.qty).slice(0, 10);
  }, [sold, menu]);
  if (!sold) return null;
  const enough = orders >= 14; // two weeks of trading in the last 30 days
  async function hide(m: MenuItem) {
    const r = await fetch("/api/menu", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...m, hidden: true }) });
    if (!r.ok) return toast((await r.json()).error);
    setHidden((h) => [...h, m.id]);
    toast(`${m.name} hidden. Bring it back any time from the list below ✿`);
  }
  const list = ideas.filter((i) => !hidden.includes(i.m.id));
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
      <div className="sum-row" style={{ alignItems: "center" }}>
        <h3 style={{ fontSize: "1.15rem" }}>✂️ Menu tidy-up · {menu.filter((m) => m.cat !== "shop").length} items on now</h3>
        {enough && list.length > 0 && <button className="link-btn small" onClick={() => setOpen((o) => !o)}>{open ? "Hide ideas" : `${list.length} idea${list.length === 1 ? "" : "s"}`}</button>}
      </div>
      <p className="small muted">{!enough ? "Once there are a couple of weeks of orders, this suggests slow sellers with thin margins you could take off. Hidden items stay saved." : list.length ? "Slow sellers (last 30 days) that also make less than average. New items, seasonal ones and staff picks are left alone." : "Nothing stands out: every item is pulling its weight ✓"}</p>
      {open && enough && (
        <ul className="check-list">
          {list.map(({ m, qty, margin }) => (
            <li key={m.id}>
              <span style={{ flex: 1 }}><b>{m.name}</b> <span className="muted small">· {qty ? `${qty} sold, ${rupees(Math.round(margin))} profit each` : "not ordered in 30 days"}</span></span>
              <button className="btn btn-ghost btn-sm" onClick={() => hide(m)}>Hide</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
