"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "./Store";
import { rupees } from "@/lib/pricing";

type Sub = { id: number; item_id: string; label: string; price: number; every_days: number; method: string; address: string | null; next_date: string; status: string; last_order: string | null };
type Bean = { id: string; name: string; price: number; variants: { id: string; label: string; price: number }[] };
type Data = { subs: Sub[]; beans: Bean[]; deliveryFee: number; freeOver: number };
const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const dayName = (d: string) => new Date(d + "T12:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

/** Account page: fresh beans every 2 or 4 weeks */
export default function BeanSubs() {
  const { toast } = useStore();
  const params = useSearchParams();
  const [d, setD] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ itemId: "", variant: "", qty: 1, every: 28, method: "pickup", address: "" });
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => fetch("/api/account/beans").then((r) => (r.ok ? r.json() : null)).then((x: Data | null) => {
    if (!x) return;
    setD(x);
    setF((v) => (v.itemId ? v : { ...v, itemId: x.beans[0]?.id ?? "", variant: x.beans[0]?.variants[0]?.id ?? "" }));
  }).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  // Arrived from "Subscribe" on a bag of beans
  useEffect(() => {
    const id = params.get("subscribe");
    if (!id || !d) return;
    const bean = d.beans.find((b) => b.id === id);
    if (bean) {
      setF((v) => ({ ...v, itemId: bean.id, variant: bean.variants[0]?.id ?? "" }));
      setOpen(true);
      document.getElementById("beans")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [params, d]);

  if (!d || !d.beans.length) return null;
  const bean = d.beans.find((b) => b.id === f.itemId);
  const price = bean ? (bean.price + (bean.variants.find((v) => v.id === f.variant)?.price ?? 0)) * f.qty : 0;
  const fee = f.method === "delivery" && price < d.freeOver ? d.deliveryFee : 0;

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/account/beans", json("POST", f));
    const x = await r.json();
    setBusy(false);
    if (!r.ok) return toast(x.error);
    toast(`Subscribed ✿ First bag: ${dayName(x.next)}`);
    setOpen(false);
    load();
  }
  async function act(id: number, action: string, msg: string) {
    const r = await fetch("/api/account/beans", json("PATCH", { id, action }));
    if (!r.ok) return toast((await r.json()).error);
    toast(msg);
    load();
  }

  return (
    <div id="beans" className="card account-card" style={{ marginTop: "1.2rem" }}>
      <h3>☕ Bean subscription</h3>
      {!d.subs.length && !open && <p className="small muted">Fresh-roasted beans every 2 or 4 weeks, ready to pick up or delivered. Pay when you get them, and pause or skip whenever you like.</p>}
      {d.subs.map((s) => (
        <div key={s.id} className="regular-row">
          <div>
            <b>{s.label}</b>
            <p className="small muted">
              {rupees(s.price)} every {s.every_days / 7} weeks · {s.method === "delivery" ? "delivered" : "pickup"}
              {" · "}{s.status === "active" ? `next: ${dayName(s.next_date)}` : "paused"}
            </p>
          </div>
          <div className="row" style={{ gap: "0.4rem" }}>
            {s.status === "active" && <button className="btn btn-ghost btn-sm" onClick={() => act(s.id, "skip", "Skipped one ✓")}>Skip next</button>}
            <button className="btn btn-ghost btn-sm" onClick={() => act(s.id, s.status === "active" ? "pause" : "resume", s.status === "active" ? "Paused" : "Back on ✿")}>{s.status === "active" ? "Pause" : "Resume"}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => act(s.id, "cancel", "Subscription cancelled")} aria-label="Cancel this subscription">✕</button>
          </div>
        </div>
      ))}
      {open ? (
        <form className="regular-form" onSubmit={start} style={{ marginTop: "0.6rem" }}>
          <div className="row">
            <label className="field">Coffee
              <select className="input" value={f.itemId} onChange={(e) => { const b = d.beans.find((x) => x.id === e.target.value); setF({ ...f, itemId: e.target.value, variant: b?.variants[0]?.id ?? "" }); }}>
                {d.beans.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            {!!bean?.variants.length && (
              <label className="field">Grind
                <select className="input" value={f.variant} onChange={(e) => setF({ ...f, variant: e.target.value })}>
                  {bean.variants.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                </select>
              </label>
            )}
          </div>
          <div className="row">
            <label className="field">Bags
              <select className="input" value={f.qty} onChange={(e) => setF({ ...f, qty: Number(e.target.value) })}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select>
            </label>
            <label className="field">How often
              <select className="input" value={f.every} onChange={(e) => setF({ ...f, every: Number(e.target.value) })}><option value={14}>Every 2 weeks</option><option value={28}>Every 4 weeks</option></select>
            </label>
          </div>
          <div className="chips" style={{ justifyContent: "flex-start" }} role="radiogroup" aria-label="Pickup or delivery">
            {["pickup", "delivery"].map((m) => <button type="button" key={m} role="radio" aria-checked={f.method === m} className={`chip ${f.method === m ? "on" : ""}`} onClick={() => setF({ ...f, method: m })}>{m === "pickup" ? "I'll pick it up" : "Deliver it"}</button>)}
          </div>
          {f.method === "delivery" && <label className="field">Delivery address<textarea className="input" rows={2} maxLength={200} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></label>}
          <p className="small muted">{rupees(price + fee)} each time{fee ? ` (incl. ${rupees(fee)} delivery)` : ""}, paid {f.method === "delivery" ? "on delivery" : "at the counter"}. The first bag is packed today (or next time we&apos;re open).</p>
          <div className="row">
            <button className="btn btn-pink btn-sm" disabled={busy}>{busy ? "Saving…" : "Subscribe"}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      ) : d.subs.length < 3 && <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>{d.subs.length ? "Add another" : "Start a subscription"}</button>}
    </div>
  );
}
