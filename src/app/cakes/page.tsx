"use client";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { usePay } from "@/components/Payment";
import { hoursOn, parseDate, toDateStr } from "@/lib/cafe";
import { photo, type MenuItem } from "@/lib/menu";
import { rupees } from "@/lib/pricing";
import { CAKE_MESSAGE_MAX, type WholeCake } from "@/lib/cakes";

type C = WholeCake & { item: MenuItem };

function CakeOrder() {
  const { me, toast } = useStore();
  const pay = usePay();
  const router = useRouter();
  const params = useSearchParams();
  const [d, setD] = useState<{ cakes: C[]; leadDays: number } | null>(null);
  const [pick, setPick] = useState("");
  const [f, setF] = useState({ size: "", message: "", date: "", time: "16:00", name: "", phone: "", email: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/cakes").then((r) => r.json()).then((x) => {
      setD(x);
      const want = params.get("item");
      const first = x.cakes.find((c: C) => c.itemId === want) ?? x.cakes[0];
      if (first) { setPick(first.itemId); setF((v) => ({ ...v, size: first.sizes[0].id })); }
      setF((v) => ({ ...v, date: toDateStr(new Date(Date.now() + x.leadDays * 86_400_000)) }));
    }).catch(() => {});
  }, [params]);
  useEffect(() => { if (me) setF((v) => ({ ...v, name: v.name || me.name || "", email: v.email || me.email, phone: v.phone || me.phone || "" })); }, [me]);
  if (!d) return <div className="page center"><p className="muted">Loading…</p></div>;
  const cake = d.cakes.find((c) => c.itemId === pick);
  const size = cake?.sizes.find((s) => s.id === f.size);
  const day = parseDate(f.date);
  const closed = day && !hoursOn(day);

  async function order(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch("/api/cakes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, itemId: pick }) });
    const x = await r.json();
    if (!r.ok) { setBusy(false); return setError(x.error); }
    const ok = await pay("cake", x.code, { name: f.name, email: f.email, phone: f.phone });
    setBusy(false);
    if (ok) { toast("Cake booked! 🎂"); router.push(`/cakes/${x.code}`); }
    else setError("Payment didn't go through. Your cake isn't booked until it's paid. Try again?");
  }

  return (
    <div className="page narrow">
      <p className="eyebrow">order {d.leadDays} days ahead</p>
      <h1 className="h2">Whole cakes, <em>made for you</em></h1>
      <p className="lead">Birthdays, office treats or just because. Pick a cake, add a message for the top, and collect it on the day.</p>
      <div className="cake-grid" role="radiogroup" aria-label="Cake">
        {d.cakes.map((c) => (
          <button key={c.itemId} type="button" role="radio" aria-checked={pick === c.itemId} className={`cake-pick card ${pick === c.itemId ? "on" : ""}`} onClick={() => { setPick(c.itemId); setF((v) => ({ ...v, size: c.sizes[0].id })); }}>
            <span className="cake-ph"><Image src={photo(c.item.img, 500)} alt="" fill sizes="200px" /></span>
            <b>{c.item.name}</b>
            <small className="muted">from {rupees(Math.min(...c.sizes.map((s) => s.price)))}</small>
          </button>
        ))}
      </div>
      {cake && (
        <form className="card" onSubmit={order} style={{ padding: "1.3rem", marginTop: "1.2rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          <p className="small muted" style={{ margin: 0 }}>{cake.item.desc}</p>
          <div className="chips" style={{ justifyContent: "flex-start" }} role="radiogroup" aria-label="Size">
            {cake.sizes.map((s) => <button key={s.id} type="button" role="radio" aria-checked={f.size === s.id} className={`chip ${f.size === s.id ? "on" : ""}`} onClick={() => setF({ ...f, size: s.id })}>{s.label} · {rupees(s.price)}</button>)}
          </div>
          {cake.message && <label className="field">Message on top <span className="muted small">· optional, up to {CAKE_MESSAGE_MAX} letters</span><input className="input" maxLength={CAKE_MESSAGE_MAX} placeholder="Happy birthday, Meera!" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></label>}
          <div className="row">
            <label className="field">Pickup date<input className="input" type="date" required min={toDateStr(new Date(Date.now() + d.leadDays * 86_400_000))} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
            <label className="field">Time<input className="input" type="time" required step={900} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></label>
          </div>
          {closed && <p className="small cashup-bad">We&apos;re closed that day. Please pick another.</p>}
          <div className="row">
            <label className="field">Name<input className="input" required maxLength={40} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label className="field">Phone<input className="input" required inputMode="numeric" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
          </div>
          <label className="field">Email<input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          <label className="field">Anything else? <span className="muted small">· eggless, candles, allergies</span><input className="input" maxLength={200} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-pink full" disabled={busy || !size || !!closed}>{busy ? "One moment…" : `Order & pay ${size ? rupees(size.price) : ""}`}</button>
          <p className="tiny muted">Paid now, so we can bake it just for you. Need to change it? Call us at least a day before.</p>
        </form>
      )}
    </div>
  );
}

export default function CakesPage() {
  return <Suspense fallback={null}><CakeOrder /></Suspense>;
}
