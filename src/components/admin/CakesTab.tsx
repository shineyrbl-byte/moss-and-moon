"use client";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "../Store";
import { rupees } from "@/lib/pricing";
import { toDateStr } from "@/lib/cafe";

type C = { code: string; cake_name: string; size_label: string; message: string | null; pickup_date: string; pickup_time: string; name: string; phone: string; note: string | null; price: number; status: string };

/** Staff: whole cakes to bake and hand over, by pickup day */
export default function CakesTab() {
  const { toast } = useStore();
  const [list, setList] = useState<C[] | null>(null);
  const load = useCallback(() => fetch("/api/cakes?orders=1").then((r) => r.json()).then(setList).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  if (!list) return <p className="muted">Loading…</p>;
  async function set(c: C, status: string, msg: string) {
    const r = await fetch(`/api/cakes/${c.code}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!r.ok) return toast((await r.json()).error);
    toast(msg);
    load();
  }
  const today = toDateStr(new Date()), tomorrow = toDateStr(new Date(Date.now() + 86_400_000));
  const dayLabel = (d: string) => (d === today ? "Today" : d === tomorrow ? "Tomorrow" : new Date(d + "T12:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" }));
  const days = [...new Set(list.map((c) => c.pickup_date))];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <p className="small muted">Paid whole-cake orders from <a href="/cakes" target="_blank">/cakes</a>. Guests order {2} days ahead, so tomorrow&apos;s list is your baking list.</p>
      {!list.length && <p className="muted">No cake orders coming up.</p>}
      {days.map((d) => (
        <section key={d} className="card" style={{ padding: "1rem 1.2rem" }}>
          <h3 style={{ fontSize: "1.15rem" }}>🎂 {dayLabel(d)} <span className="muted small">· {list.filter((c) => c.pickup_date === d && c.status !== "collected").length} to go</span></h3>
          <ul className="check-list">
            {list.filter((c) => c.pickup_date === d).map((c) => (
              <li key={c.code} style={{ opacity: c.status === "collected" ? 0.5 : 1 }}>
                <span style={{ flex: 1 }}>
                  <b>{c.pickup_time} · {c.cake_name}</b> ({c.size_label}){c.message && <> · on top: <b>“{c.message}”</b></>}
                  <br /><small className="muted">{c.name} · <a href={`tel:${c.phone}`}>{c.phone}</a> · {c.code} · {rupees(c.price)} paid{c.note ? ` · ${c.note}` : ""}</small>
                </span>
                {c.status === "paid" && <button className="btn btn-ghost btn-sm" onClick={() => set(c, "ready", "Marked ready")}>Ready</button>}
                {c.status !== "collected" && <button className="btn btn-pink btn-sm" onClick={() => set(c, "collected", "Handed over 🎂")}>Collected</button>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
