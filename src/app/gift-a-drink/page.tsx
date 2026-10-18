"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/components/Store";
import { usePay } from "@/components/Payment";
import DrinkCup from "@/components/DrinkCup";
import { photo } from "@/lib/menu";
import { cleanOptions, describeOptions, isDrink, rupees, unitPrice, type Options } from "@/lib/pricing";

function GiftDrink() {
  const params = useSearchParams();
  const router = useRouter();
  const { find, menu, me, setCustomizing } = useStore();
  const pay = usePay();
  const item = find(params.get("item") ?? "");
  const opts = useMemo<Options>(() => {
    try { return item ? cleanOptions(item, JSON.parse(params.get("o") ?? "{}")) : {}; } catch { return {}; }
  }, [item, params]);
  const [f, setF] = useState({ fromName: "", fromEmail: "", toName: "", toEmail: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("mm-me") || "{}");
      setF((x) => ({ ...x, fromName: x.fromName || me?.name || saved.name || "", fromEmail: x.fromEmail || me?.email || saved.email || "" }));
    } catch {}
  }, [me]);

  if (!item || !isDrink(item.cat))
    return (
      <div className="page narrow center">
        <p className="eyebrow">buy a friend a coffee</p>
        <h1 className="h2">Pick a <em>drink</em> to gift</h1>
        <p className="lead">Tap any drink on the menu, choose how they like it, then tap <b>🎁 Gift it</b>.</p>
        <div className="chips" style={{ marginTop: "1.2rem" }}>
          {menu.filter((m) => isDrink(m.cat) && !m.soldOut).slice(0, 8).map((m) => (
            <button key={m.id} className="chip" onClick={() => setCustomizing(m)}>{m.name}</button>
          ))}
        </div>
        <Link href="/#menu" className="btn btn-ghost" style={{ marginTop: "1.5rem" }}>See the whole menu</Link>
      </div>
    );

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    setBusy(true);
    setError("");
    const r = await fetch("/api/drink-gifts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: item.id, opts, ...f }) });
    const d = await r.json();
    if (!r.ok) { setBusy(false); return setError(d.error); }
    const ok = await pay("drinkgift", d.code, { name: f.fromName, email: f.fromEmail });
    setBusy(false);
    if (!ok) return setError("Payment didn't finish. Try again?");
    router.push(`/d/${d.code}?sent=1`);
  }

  return (
    <div className="page narrow">
      <p className="eyebrow">buy a friend a coffee</p>
      <h1 className="h2">Send a <em>{item.name}</em></h1>
      <div className="card gift-drink-preview">
        <div className="gift-drink-photo"><Image src={photo(item.img, 300)} alt="" fill sizes="96px" /></div>
        <div style={{ flex: 1 }}>
          <strong>{item.name}</strong>
          <p className="small muted">{describeOptions(item, opts) || "as it comes"}</p>
          <p><b>{rupees(unitPrice(item, opts))}</b></p>
        </div>
        <DrinkCup item={item} opts={opts} />
      </div>
      <form className="card booking" onSubmit={send} style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        <div className="row">
          <label className="field">Your name<input className="input" required maxLength={40} value={f.fromName} onChange={(e) => setF({ ...f, fromName: e.target.value })} /></label>
          <label className="field">Your friend&apos;s name<input className="input" required maxLength={40} value={f.toName} onChange={(e) => setF({ ...f, toName: e.target.value })} /></label>
        </div>
        <label className="field">A little note (optional)<textarea className="input" rows={2} maxLength={140} placeholder="For surviving Monday ✿" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></label>
        <label className="field">Their email (optional, we&apos;ll send it to them)<input className="input" type="email" placeholder="friend@example.com" value={f.toEmail} onChange={(e) => setF({ ...f, toEmail: e.target.value })} /></label>
        <label className="field">Your email (optional, for the receipt and link)<input className="input" type="email" value={f.fromEmail} onChange={(e) => setF({ ...f, fromEmail: e.target.value })} /></label>
        <p className="small muted">You&apos;ll get a link to send on WhatsApp or anywhere. They claim it whenever they like within 90 days.</p>
        {error && <p className="error small">{error}</p>}
        <button className="btn btn-pink" disabled={busy}>{busy ? "Opening payment…" : `Pay ${rupees(unitPrice(item, opts))} & get the link`}</button>
      </form>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="page center muted">Loading…</div>}><GiftDrink /></Suspense>;
}
