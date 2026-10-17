"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useEscape, useStore } from "./Store";
import { usePay } from "./Payment";
import { photo } from "@/lib/menu";
import { HAPPY_HOUR, describeOptions, quote, rupees, unitPrice } from "@/lib/pricing";
import { HOURS, STAMPS_FOR_REWARD } from "@/lib/cafe";
import { rememberOrder } from "@/lib/history";

type Loyalty = { stamps: number; hasReward: boolean; found: boolean };
type Gift = { code: string; balance: number };

/** Pickup times for today in 15-minute steps */
function pickupTimes() {
  const now = new Date();
  const [, close] = HOURS[now.getDay()];
  const start = Math.ceil((now.getHours() * 60 + now.getMinutes() + 15) / 15) * 15;
  const out: string[] = [];
  for (let t = start; t <= close * 60 - 15; t += 15) out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  return out;
}

const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export default function CartDrawer() {
  const { lines, setQty, clear, drawerOpen, setDrawerOpen, soldOut, refreshSoldOut, toast, find, table, setTable, me } = useStore();
  const pay = usePay();
  const router = useRouter();
  const [step, setStep] = useState<"tray" | "checkout">("tray");
  const [code, setCode] = useState("");
  const [promo, setPromo] = useState<{ code: string; label: string } | null>(null);
  const [gift, setGift] = useState<Gift | null>(null);
  const [codeErr, setCodeErr] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", pickup: "asap", note: "" });
  const [payMethod, setPayMethod] = useState<"online" | "counter">("online");
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);
  const [wait, setWait] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [, tick] = useState(0);

  const close = useCallback(() => setDrawerOpen(false), [setDrawerOpen]);
  useEscape(drawerOpen, close);

  useEffect(() => {
    if (!drawerOpen) return setStep("tray");
    refreshSoldOut();
    tick((t) => t + 1); // re-check happy hour
    fetch("/api/queue").then((r) => r.json()).then((d) => setWait(d.minutes)).catch(() => {});
  }, [drawerOpen, refreshSoldOut]);

  // Remember name, phone & email for next time
  useEffect(() => {
    try {
      const me = JSON.parse(localStorage.getItem("mm-me") || "{}");
      setForm((f) => ({ ...f, name: me.name ?? "", phone: me.phone ?? "", email: me.email ?? "" }));
    } catch {}
  }, []);

  // Signed in: fill in anything still empty from the account
  useEffect(() => {
    if (!me) return;
    setForm((f) => ({ ...f, name: f.name || me.name || "", phone: f.phone || me.phone || "", email: f.email || me.email }));
  }, [me]);

  // Check stamp card once a full phone number is typed
  const digits = form.phone.replace(/\D/g, "");
  useEffect(() => {
    if (digits.length !== 10) return setLoyalty(null);
    fetch(`/api/loyalty?phone=${digits}`).then((r) => r.json()).then(setLoyalty).catch(() => {});
  }, [digits]);

  const q = useMemo(() => quote(lines, find, promo?.code, !!loyalty?.hasReward, { giftBalance: gift?.balance }), [lines, find, promo, loyalty, gift]);
  const times = useMemo(() => (step === "checkout" ? pickupTimes() : []), [step]);
  const hasSoldOut = lines.some((l) => soldOut.has(l.itemId) || !find(l.itemId));

  // One box for both promo codes and gift cards
  async function applyCode() {
    setCodeErr("");
    const c = code.trim().toUpperCase();
    if (c.startsWith("GIFT-")) {
      const r = await fetch(`/api/giftcards/${encodeURIComponent(c)}`);
      const d = await r.json();
      if (!r.ok) return setCodeErr(d.error);
      if (d.balance <= 0) return setCodeErr("That gift card has been fully spent.");
      setGift({ code: d.code, balance: d.balance });
      toast(`Gift card applied · ${rupees(d.balance)} available 🎁`);
    } else {
      const r = await post("/api/promo", { code: c });
      const d = await r.json();
      if (!r.ok) return setCodeErr(d.error);
      setPromo(d);
      toast(`Code applied: ${d.label}`);
    }
    setCode("");
  }

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await post("/api/orders", {
        ...form,
        payMethod,
        table,
        promo: promo?.code,
        giftCard: gift?.code,
        lines: lines.map(({ itemId, opts, qty }) => ({ itemId, opts, qty })),
      });
      const d = await r.json();
      if (!r.ok) {
        if (r.status === 409) refreshSoldOut();
        return setError(d.error);
      }
      try { localStorage.setItem("mm-me", JSON.stringify({ name: form.name, phone: form.phone, email: form.email })); } catch {}
      rememberOrder(d.code);
      clear();
      setPromo(null);
      setGift(null);
      close();

      if (d.needsPayment) {
        const paid = await pay("order", d.code, { name: form.name, email: form.email, phone: digits });
        toast(paid ? "Paid & placed! ☕" : "Order saved — you can pay on the next page or at the counter.");
      } else {
        toast(d.usedReward ? "Order placed — your free drink is on us! 🎉" : "Order placed! ☕");
      }
      router.push(`/order/${d.code}`);
    } catch {
      setError("Couldn't reach the café. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const summary = (
    <>
      <div className="sum-row"><span>Subtotal</span><span>{rupees(q.subtotal)}</span></div>
      {q.happyDiscount > 0 && <div className="sum-row discount"><span>Golden hour (bakes −20%)</span><span>−{rupees(q.happyDiscount)}</span></div>}
      {q.promoDiscount > 0 && <div className="sum-row discount"><span>Promo ({q.promoCode})</span><span>−{rupees(q.promoDiscount)}</span></div>}
      {q.loyaltyDiscount > 0 && <div className="sum-row discount"><span>Free drink reward</span><span>−{rupees(q.loyaltyDiscount)}</span></div>}
      {q.giftUsed > 0 && <div className="sum-row discount"><span>Gift card</span><span>−{rupees(q.giftUsed)}</span></div>}
      <div className="sum-row total"><span>{step === "checkout" && q.due > 0 ? (payMethod === "online" ? "To pay now" : "Pay at pickup") : "Total"}</span><span>{rupees(q.due)}</span></div>
    </>
  );

  return (
    <>
      <div className={`overlay ${drawerOpen ? "show" : ""}`} onClick={close} />
      <aside className={`drawer ${drawerOpen ? "open" : ""}`} aria-hidden={!drawerOpen} aria-label="Your tray">
        <div className="drawer-head">
          {step === "checkout" ? (
            <button className="btn btn-ghost btn-sm" onClick={() => setStep("tray")}>← Tray</button>
          ) : (
            <h3>Your tray</h3>
          )}
          <button className="icon-btn" onClick={close} aria-label="Close tray">✕</button>
        </div>

        {step === "tray" ? (
          <>
            <div className="drawer-body">
              {table && <div className="reward-banner table-note" style={{ marginTop: "0.8rem" }}>🪑 Ordering for <b>table {table}</b> — we&apos;ll bring it over.</div>}
              {q.happyHour && <div className="reward-banner" style={{ marginTop: "0.8rem" }}>✨ {HAPPY_HOUR.label}</div>}
              {!lines.length && (
                <div className="empty-state">
                  <p>Your tray is empty — pick something cosy ☕</p>
                  <Link href="/orders" className="small" style={{ textDecoration: "underline" }} onClick={close}>See past orders</Link>
                </div>
              )}
              {lines.map((l) => {
                const item = find(l.itemId);
                if (!item)
                  return (
                    <div className="line" key={l.key}>
                      <div className="line-info"><strong>No longer on the menu</strong><small className="error">Please remove this item</small></div>
                      <button className="chip" onClick={() => setQty(l.key, 0)}>Remove</button>
                    </div>
                  );
                return (
                  <div className="line" key={l.key}>
                    <div className="line-thumb"><Image src={photo(item.img, 200)} alt="" fill sizes="56px" /></div>
                    <div className="line-info">
                      <strong>{item.name}</strong>
                      <small>{describeOptions(item, l.opts) || "as it comes"}</small>
                      {soldOut.has(item.id) ? <small className="error" style={{ display: "block" }}>Sold out — please remove</small> : <small style={{ display: "block" }}>{rupees(unitPrice(item, l.opts) * l.qty)}</small>}
                    </div>
                    <div className="stepper">
                      <button onClick={() => setQty(l.key, l.qty - 1)} aria-label="One less">−</button>
                      {l.qty}
                      <button onClick={() => setQty(l.key, l.qty + 1)} aria-label="One more">+</button>
                    </div>
                  </div>
                );
              })}
              {lines.length > 0 && (
                <div style={{ marginTop: "1.2rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {promo && <p className="small success">✓ {promo.code}: {promo.label} <button className="link-btn" onClick={() => setPromo(null)}>remove</button></p>}
                  {gift && <p className="small success">🎁 {gift.code}: {rupees(gift.balance)} available <button className="link-btn" onClick={() => setGift(null)}>remove</button></p>}
                  <div className="row">
                    <input className="input" style={{ flex: 1 }} placeholder="Promo or gift card code" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyCode()} />
                    <button className="btn btn-ghost btn-sm" onClick={applyCode} disabled={!code.trim()}>Apply</button>
                  </div>
                  {codeErr && <p className="error small">{codeErr}</p>}
                  <p className="small muted">Try <b>BLOOM10</b> for 10% off.</p>
                </div>
              )}
            </div>
            <div className="drawer-foot">
              {summary}
              <button className="btn full" disabled={!lines.length || hasSoldOut} onClick={() => setStep("checkout")}>Checkout →</button>
            </div>
          </>
        ) : (
          <form onSubmit={placeOrder} style={{ display: "contents" }}>
            <div className="drawer-body" style={{ display: "flex", flexDirection: "column", gap: "0.9rem", paddingTop: "1rem" }}>
              <h3 style={{ fontSize: "1.8rem" }}>Almost there ✿</h3>
              {wait !== null && <p className="small muted">⏱ Ready in about <b>{wait} min</b> right now</p>}
              <label className="field">Your name<input className="input" required maxLength={40} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="field">
                {table ? "Phone (optional — to collect a stamp)" : "Phone (for your stamp card)"}
                <input className="input" required={!table} inputMode="numeric" placeholder="10 digits" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
              {loyalty && (
                <div className="reward-banner">
                  {loyalty.hasReward
                    ? "🎉 You've got a free drink! We'll take your cheapest drink off this order."
                    : `☕ ${loyalty.stamps}/${STAMPS_FOR_REWARD} stamps — this order adds one more.`}
                </div>
              )}
              <label className="field">Email (optional — for your receipt & "it's ready" note)<input className="input" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              {table ? (
                <div className="reward-banner table-note">
                  🪑 We&apos;ll bring it to <b>table {table}</b>.{" "}
                  <button type="button" className="link-btn" onClick={() => setTable(null)}>Picking up instead?</button>
                </div>
              ) : (
                <label className="field">Pickup time
                  <select className="input" value={form.pickup} onChange={(e) => setForm({ ...form, pickup: e.target.value })}>
                    <option value="asap">As soon as possible</option>
                    {times.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
              )}
              {q.due > 0 && (
                <div className="field">
                  How would you like to pay?
                  <div className="pay-options">
                    <button type="button" className={`pay-opt ${payMethod === "online" ? "on" : ""}`} onClick={() => setPayMethod("online")}>
                      <span>📱</span><b>Pay now</b><small>UPI · card</small>
                    </button>
                    <button type="button" className={`pay-opt ${payMethod === "counter" ? "on" : ""}`} onClick={() => setPayMethod("counter")}>
                      <span>🪙</span><b>At the counter</b><small>cash · UPI</small>
                    </button>
                  </div>
                </div>
              )}
              <label className="field">Anything we should know?<textarea className="input" rows={2} maxLength={200} placeholder="Allergies, a name for the cup…" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
            </div>
            <div className="drawer-foot">
              {summary}
              {error && <p className="error">{error}</p>}
              <button className="btn btn-pink full" disabled={busy}>
                {busy ? "Placing order…" : q.due === 0 ? "Place order (covered ✿)" : payMethod === "online" ? `Pay ${rupees(q.due)} & order` : "Place order"}
              </button>
            </div>
          </form>
        )}
      </aside>
    </>
  );
}
