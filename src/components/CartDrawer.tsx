"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useEscape, useStore } from "./Store";
import BranchPicker from "./BranchPicker";
import { isLastHour, lastHour } from "@/lib/cafe";
import { usePay } from "./Payment";
import { photo } from "@/lib/menu";
import { HAPPY_HOUR, REWARDS, TIP_CHOICES, findReward, deliveryTerms, deliveryZones, describeOptions, happyHour, combosAt, combosConfig, quote, rupees, unitPrice, type PromoRule } from "@/lib/pricing";
import { STAMPS_FOR_REWARD, hoursOn } from "@/lib/cafe";
import { rememberOrder } from "@/lib/history";

type Loyalty = { stamps: number; hasReward: boolean; found: boolean };
type Gift = { code: string; balance: number };

/** Pickup times for today in 15-minute steps */
function pickupTimes(branch?: string) {
  const now = new Date();
  const today = hoursOn(now, branch);
  if (!today) return [];
  const [, close] = today;
  const start = Math.ceil((now.getHours() * 60 + now.getMinutes() + 15) / 15) * 15;
  const out: string[] = [];
  for (let t = start; t <= close * 60 - 15; t += 15) out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  return out;
}

/** Pickup times tomorrow, from 15 minutes after opening */
function tomorrowTimes(branch?: string) {
  const d = new Date(Date.now() + 86_400_000);
  const h = hoursOn(d, branch);
  if (!h) return [];
  const out: string[] = [];
  for (let t = h[0] * 60 + 15; t <= h[1] * 60 - 15; t += 15) out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  return out;
}

const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export default function CartDrawer() {
  const { lines, setQty, clear, drawerOpen, setDrawerOpen, soldOut, refreshSoldOut, toast, find, table, setTable, me, t, group, setGroup, branch } = useStore();
  const pay = usePay();
  const router = useRouter();
  const [step, setStep] = useState<"tray" | "checkout">("tray");
  const [code, setCode] = useState("");
  const [promo, setPromo] = useState<{ code: string; label: string; rule: PromoRule } | null>(null);
  const [gift, setGift] = useState<Gift | null>(null);
  const [codeErr, setCodeErr] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", pickup: "asap", note: "" });
  const [payMethod, setPayMethod] = useState<"online" | "counter" | "company">("online");
  const [tipPercent, setTipPercent] = useState(0);
  const [mode, setMode] = useState<"pickup" | "delivery">("pickup");
  const [address, setAddress] = useState("");
  // "Order for tomorrow": saved now, made 15 minutes before pickup tomorrow
  const [later, setLater] = useState(false);
  const [ownCup, setOwnCup] = useState(false);
  // Stamp rewards: "" = the usual (free drink at 10), "none" = save them, or a reward id
  const [reward, setReward] = useState("");
  const laterTimes = useMemo(() => tomorrowTimes(branch), [branch]);
  const [pincode, setPincode] = useState("");
  const hasZones = deliveryZones().length > 0;
  const [usePass, setUsePass] = useState(true);
  const [useBirthday, setUseBirthday] = useState(true);
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);
  const [wait, setWait] = useState<number | null>(null);
  const [rush, setRush] = useState<"off" | "busy" | "paused">("off");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [, tick] = useState(0);

  const close = useCallback(() => setDrawerOpen(false), [setDrawerOpen]);
  useEscape(drawerOpen, close);

  // A code won on the surprise wheel: apply it when the tray opens
  useEffect(() => {
    if (!drawerOpen || promo) return;
    let won: string | null = null;
    try { won = sessionStorage.getItem("mm-promo"); } catch {}
    if (!won) return;
    post("/api/promo", { code: won }).then(async (r) => {
      const d = await r.json();
      try { sessionStorage.removeItem("mm-promo"); } catch {}
      if (r.ok) { setPromo(d); toast(`Code applied: ${d.label}`); }
    }).catch(() => {});
  }, [drawerOpen, promo, toast]);

  useEffect(() => {
    if (!drawerOpen) return setStep("tray");
    refreshSoldOut();
    tick((t) => t + 1); // re-check happy hour
    fetch("/api/queue").then((r) => r.json()).then((d) => { setWait(d.minutes); setRush(d.rush ?? "off"); }).catch(() => {});
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

  // Stamps can only be spent from the signed-in account with this phone
  const ownsCard = !!me?.phone && me.phone.replace(/\D/g, "").slice(-10) === digits;
  const delivery = !table && mode === "delivery";
  const terms = delivery ? deliveryTerms(hasZones ? (pincode.length === 6 ? pincode : null) : null) : null;
  const q = useMemo(
    () =>
      quote(lines, find, promo?.rule, !!loyalty?.hasReward && reward !== "none" && ownsCard, {
        reward: reward && reward !== "none" ? findReward(reward) ?? null : null,
        giftBalance: gift?.balance,
        credit: me?.perks?.credit ?? 0,
        birthdayTreat: !!me?.perks?.birthdayTreat && useBirthday,
        passDrink: !!me?.perks?.passDrink && usePass,
        tier: me?.perks?.tier,
        lastHour: isLastHour(new Date(), branch) ? lastHour() : null,
        student: !!me?.perks?.student,
        combos: combosAt(combosConfig()),
        ownCup: ownCup && !table,
        tipPercent: step === "checkout" ? tipPercent : 0,
        delivery: terms ? { fee: terms.fee, freeOver: terms.freeOver } : delivery,
      }),
    [lines, find, promo, loyalty, gift, me, useBirthday, usePass, tipPercent, delivery, step, branch, terms, ownCup, table, reward, ownsCard]
  );
  const times = useMemo(() => (step === "checkout" ? pickupTimes(branch) : []), [step, branch]);
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
      const r = await post("/api/promo", { code: c, phone: form.phone });
      const d = await r.json();
      if (!r.ok) return setCodeErr(d.error);
      setPromo(d);
      toast(`Code applied: ${d.label}`);
    }
    setCode("");
  }

  const addingToGroup = !!group && !group.checkout;

  // Group order (not the host's checkout): send these items to the shared tray
  async function addToGroup() {
    if (!group) return;
    setBusy(true);
    setError("");
    const r = await post(`/api/groups/${group.code}/items`, { person: group.person, lines: lines.map(({ itemId, opts, qty }) => ({ itemId, opts, qty })) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) {
      if (r.status === 404 || r.status === 409) setGroup(null);
      return setError(d.error);
    }
    clear();
    close();
    toast("Added to the group order 👯");
    router.push(`/g/${group.code}`);
  }

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    if (later && !table && mode === "pickup") {
      try {
        const d0 = new Date(Date.now() + 86_400_000);
        const pickupDate = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, "0")}-${String(d0.getDate()).padStart(2, "0")}`;
        const r = await post("/api/orders/later", { ...form, pickup: form.pickup === "asap" ? laterTimes[0] : form.pickup, pickupDate, branch, ownCup, promo: promo?.code, lines: lines.map(({ itemId, opts, qty }) => ({ itemId, opts, qty })) });
        const d = await r.json();
        if (!r.ok) return setError(d.error);
        clear();
        close();
        toast(`Saved for tomorrow at ${d.time} ✿`);
        router.push(`/later/${d.code}`);
      } catch {
        setError("Couldn't reach the café. Please try again.");
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      const r = await post("/api/orders", {
        ...form,
        payMethod,
        table,
        branch,
        promo: promo?.code,
        giftCard: gift?.code,
        tipPercent,
        ownCup: ownCup && !table,
        reward: reward || undefined,
        usePass,
        useBirthday,
        ...(delivery ? { delivery: { address, pincode } } : {}),
        ...(group?.checkout ? { groupCode: group.code, hostToken: group.hostToken } : {}),
        lines: lines.map(({ itemId, opts, qty }) => ({ itemId, opts, qty })),
      });
      const d = await r.json();
      if (!r.ok) {
        if (r.status === 409) refreshSoldOut();
        return setError(d.error);
      }
      try { localStorage.setItem("mm-me", JSON.stringify({ name: form.name, phone: form.phone, email: form.email })); } catch {}
      rememberOrder(d.code);
      if (group?.checkout) setGroup(null);
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
      for (const b of (d.newBadges ?? []) as { icon: string; name: string }[]) setTimeout(() => toast(`${b.icon} New badge: ${b.name}!`), 1200);
      router.push(`/order/${d.code}`);
    } catch {
      setError("Couldn't reach the café. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const summary = (
    <>
      <div className="sum-row"><span>{t("tray.subtotal")}</span><span>{rupees(q.subtotal)}</span></div>
      {q.happyDiscount > 0 && <div className="sum-row discount"><span>Golden hour (−{Math.round(happyHour().off * 100)}%)</span><span>−{rupees(q.happyDiscount)}</span></div>}
      {q.promoDiscount > 0 && <div className="sum-row discount"><span>Promo ({q.promoCode})</span><span>−{rupees(q.promoDiscount)}</span></div>}
      {q.loyaltyDiscount > 0 && <div className="sum-row discount"><span>Free drink reward</span><span>−{rupees(q.loyaltyDiscount)}</span></div>}
      {q.passDiscount > 0 && <div className="sum-row discount"><span>☕ Coffee Pass drink</span><span>−{rupees(q.passDiscount)}</span></div>}
      {q.tierDiscount > 0 && <div className="sum-row discount"><span>{me?.perks?.tier === "gold" ? "🥇 Gold: free upgrades" : "🥈 Silver: free upgrade"}</span><span>−{rupees(q.tierDiscount)}</span></div>}
      {q.ownCupDiscount > 0 && <div className="sum-row discount"><span>♻️ Own cup</span><span>−{rupees(q.ownCupDiscount)}</span></div>}
      {q.combos.map((c) => <div key={c.id} className="sum-row discount"><span>🍱 {c.name}{c.count > 1 ? ` × ${c.count}` : ""}</span><span>−{rupees(c.saving)}</span></div>)}
      {q.lastHourDiscount > 0 && <div className="sum-row discount"><span>🌙 Last-hour deal (−{Math.round(lastHour().off * 100)}%)</span><span>−{rupees(q.lastHourDiscount)}</span></div>}
      {q.studentDiscount > 0 && <div className="sum-row discount"><span>🎓 Student (drinks −10%)</span><span>−{rupees(q.studentDiscount)}</span></div>}
      {q.birthdayDiscount > 0 && <div className="sum-row discount"><span>🎂 Birthday treat</span><span>−{rupees(q.birthdayDiscount)}</span></div>}
      {q.creditUsed > 0 && <div className="sum-row discount"><span>💝 Your credit</span><span>−{rupees(q.creditUsed)}</span></div>}
      {q.giftUsed > 0 && <div className="sum-row discount"><span>Gift card</span><span>−{rupees(q.giftUsed)}</span></div>}
      {q.deliveryFee > 0 && <div className="sum-row"><span>Delivery</span><span>{rupees(q.deliveryFee)}</span></div>}
      {q.tip > 0 && <div className="sum-row"><span>Tip for the team 💛</span><span>{rupees(q.tip)}</span></div>}
      <div className="sum-row total"><span>{step === "checkout" && q.due > 0 ? (payMethod === "online" ? "To pay now" : payMethod === "company" ? "On the company tab" : delivery ? "Pay on delivery" : "Pay at pickup") : t("tray.total")}</span><span>{rupees(q.due)}</span></div>
    </>
  );

  return (
    <>
      <div className={`overlay ${drawerOpen ? "show" : ""}`} onClick={close} />
      <aside className={`drawer ${drawerOpen ? "open" : ""}`} inert={!drawerOpen} aria-label="Your tray">
        <div className="drawer-head">
          {step === "checkout" ? (
            <button className="btn btn-ghost btn-sm" onClick={() => setStep("tray")}>{t("tray.back")}</button>
          ) : (
            <h3>{t("tray.title")}</h3>
          )}
          <button className="icon-btn" onClick={close} aria-label="Close tray">✕</button>
        </div>

        {step === "tray" ? (
          <>
            <div className="drawer-body">
              {group && (
                <div className="reward-banner group-note" style={{ marginTop: "0.8rem" }}>
                  👯 {group.checkout ? <>Checking out <b>{group.host}&apos;s group order</b> for everyone.</> : <>Adding to <b>{group.host}&apos;s group order</b> as {group.person}.</>}{" "}
                  <Link href={`/g/${group.code}`} className="link-btn" onClick={close}>See the group</Link>
                </div>
              )}
              {table && <div className="reward-banner table-note" style={{ marginTop: "0.8rem" }}>🪑 Ordering for <b>table {table}</b> — we&apos;ll bring it over.</div>}
              {q.happyHour && <div className="reward-banner" style={{ marginTop: "0.8rem" }}>✨ {HAPPY_HOUR.label}</div>}
              {!lines.length && (
                <div className="empty-state">
                  <p>{t("tray.empty")}</p>
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
              {error && addingToGroup && <p className="error small">{error}</p>}
              {addingToGroup ? (
                <button className="btn btn-pink full" disabled={!lines.length || hasSoldOut || busy} onClick={addToGroup}>{busy ? "Adding…" : "Add to the group order 👯"}</button>
              ) : (
                <button className="btn full" disabled={!lines.length || hasSoldOut} onClick={() => setStep("checkout")}>{t("tray.checkout")}</button>
              )}
              {!group && (
                <Link href="/g/new" className="btn btn-ghost btn-sm full" style={{ marginTop: "0.5rem" }} onClick={close}>👯 Order with friends</Link>
              )}
            </div>
          </>
        ) : (
          <form onSubmit={placeOrder} style={{ display: "contents" }}>
            <div className="drawer-body" style={{ display: "flex", flexDirection: "column", gap: "0.9rem", paddingTop: "1rem" }}>
              <h3 style={{ fontSize: "1.8rem" }}>{t("checkout.title")}</h3>
              {wait !== null && <p className="small muted">⏱ Ready in about <b>{wait} min</b> right now</p>}
              {rush === "paused" && !table && <p className="reward-banner small" role="alert">⏸ We&apos;re swamped, so online orders are paused for a few minutes. Please try again shortly, or pop in ☕</p>}
              {rush === "busy" && <p className="reward-banner small">🚦 It&apos;s busy right now, so things take a little longer. Thank you for your patience!</p>}
              <label className="field">{t("checkout.name")}<input className="input" required maxLength={40} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="field">
                {table ? "Phone (optional — to collect a stamp)" : "Phone (for your stamp card)"}
                <input className="input" required={!table} inputMode="numeric" placeholder="10 digits" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
              {loyalty && (
                <div className="reward-banner">
                  {!ownsCard && loyalty.stamps >= REWARDS[0].stamps
                    ? `☕ ${loyalty.stamps} stamps. Sign in with the account that has this phone number to spend them (so nobody else can).`
                    : loyalty.hasReward && !reward
                    ? "🎉 You've got a free drink! We'll take your cheapest drink off this order."
                    : `☕ ${loyalty.stamps} stamp${loyalty.stamps === 1 ? "" : "s"} · this order adds one more.`}
                  {ownsCard && loyalty.stamps >= REWARDS[0].stamps && (
                    <div className="chips" style={{ justifyContent: "flex-start", marginTop: "0.4rem" }} role="radiogroup" aria-label="Spend stamps">
                      <button type="button" role="radio" aria-checked={!reward} className={`chip ${!reward ? "on" : ""}`} onClick={() => setReward("")}>{loyalty.hasReward ? "Free drink" : "Keep collecting"}</button>
                      {REWARDS.filter((r) => r.id !== "drink" && r.stamps <= loyalty.stamps).map((r) => (
                        <button key={r.id} type="button" role="radio" aria-checked={reward === r.id} className={`chip ${reward === r.id ? "on" : ""}`} onClick={() => setReward(r.id)}>{r.label} · {r.stamps}★</button>
                      ))}
                      {loyalty.hasReward && <button type="button" role="radio" aria-checked={reward === "none"} className={`chip ${reward === "none" ? "on" : ""}`} onClick={() => setReward("none")}>Save them</button>}
                    </div>
                  )}
                  {reward && reward !== "none" && q.rewardId !== reward && <p className="small" style={{ margin: "0.3rem 0 0" }}>Add {findReward(reward)?.label.toLowerCase()} to your tray to use this.</p>}
                </div>
              )}
              <label className="field">Email (optional — for your receipt & "it's ready" note)<input className="input" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              {table ? (
                <div className="reward-banner table-note">
                  🪑 We&apos;ll bring it to <b>table {table}</b>.{" "}
                  <button type="button" className="link-btn" onClick={() => setTable(null)}>Picking up instead?</button>
                </div>
              ) : (
                <>
                  <BranchPicker label={mode === "delivery" ? "Deliver from" : "Pick up from"} onChange={() => setForm((f) => ({ ...f, pickup: "asap" }))} />
                  <div className="chips" style={{ justifyContent: "flex-start" }} role="radiogroup" aria-label="Pickup or delivery">
                    <button type="button" className={`chip ${mode === "pickup" ? "on" : ""}`} onClick={() => setMode("pickup")} role="radio" aria-checked={mode === "pickup"}>🛍 {t("checkout.pickup")}</button>
                    <button type="button" className={`chip ${mode === "delivery" ? "on" : ""}`} onClick={() => setMode("delivery")} role="radio" aria-checked={mode === "delivery"}>🛵 {t("checkout.delivery")}</button>
                  </div>
                  {mode === "pickup" ? (
                    <>
                      {laterTimes.length > 0 && (
                        <div className="chips" style={{ justifyContent: "flex-start" }} role="radiogroup" aria-label="Which day">
                          <button type="button" role="radio" aria-checked={!later} className={`chip ${!later ? "on" : ""}`} onClick={() => { setLater(false); setForm({ ...form, pickup: "asap" }); }}>Today</button>
                          <button type="button" role="radio" aria-checked={later} className={`chip ${later ? "on" : ""}`} onClick={() => { setLater(true); setForm({ ...form, pickup: laterTimes.find((t) => t >= "08:30") ?? laterTimes[0] }); }}>🌅 Tomorrow</button>
                        </div>
                      )}
                      <label className="field">Pickup time{later ? " tomorrow" : ""}
                        <select className="input" value={form.pickup} onChange={(e) => setForm({ ...form, pickup: e.target.value })}>
                          {!later && <option value="asap">As soon as possible</option>}
                          {(later ? laterTimes : times).map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </label>
                      {later && <p className="small muted">🌅 Saved now and made fresh 15 minutes before. Pay at the counter when you collect. You can cancel any time before.</p>}
                    </>
                  ) : (
                    <>
                      <label className="field">Delivery address
                        <textarea className="input" rows={2} required minLength={10} maxLength={200} placeholder="Flat, building, street, landmark" value={address} onChange={(e) => setAddress(e.target.value)} />
                      </label>
                      {hasZones && <label className="field">Pincode<input className="input" required inputMode="numeric" maxLength={6} placeholder="6 digits" value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} /></label>}
                      {hasZones && pincode.length === 6 && !terms && <p className="error small">Sorry, we don&apos;t deliver to {pincode} yet. Pick it up instead?</p>}
                      {terms && <p className="small muted">🛵 {terms.zone ? `${terms.zone}: ` : ""}{rupees(terms.fee)} delivery, free over {rupees(terms.freeOver)} · minimum {rupees(terms.minOrder)} · about {terms.minutes} min{terms.zone ? "" : " · nearby areas only"}</p>}
                      {terms && q.total < terms.minOrder && <p className="error small">Add {rupees(terms.minOrder - q.total)} more for delivery.</p>}
                    </>
                  )}
                </>
              )}
              {(me?.perks?.passDrink || me?.perks?.birthdayTreat) && (
                <div className="reward-banner small perk-toggles">
                  {me?.perks?.passDrink && (
                    <label><input type="checkbox" checked={usePass} onChange={(e) => setUsePass(e.target.checked)} /> ☕ Use today&apos;s Coffee Pass drink</label>
                  )}
                  {me?.perks?.birthdayTreat && (
                    <label><input type="checkbox" checked={useBirthday} onChange={(e) => setUseBirthday(e.target.checked)} /> 🎂 Happy birthday! Use your free treat</label>
                  )}
                </div>
              )}
              <div className="field">
                {t("checkout.tip")}
                <div className="chips" style={{ justifyContent: "flex-start" }}>
                  {TIP_CHOICES.map((tp) => (
                    <button type="button" key={tp} className={`chip ${tipPercent === tp ? "on" : ""}`} onClick={() => setTipPercent(tp)}>
                      {tp === 0 ? t("checkout.noTip") : `${tp}%`}
                    </button>
                  ))}
                </div>
              </div>
              {q.due > 0 && !(later && mode === "pickup" && !table) && (
                <div className="field">
                  {t("checkout.how")}
                  <div className="pay-options">
                    <button type="button" className={`pay-opt ${payMethod === "online" ? "on" : ""}`} onClick={() => setPayMethod("online")}>
                      <span>📱</span><b>{t("checkout.payNow")}</b><small>UPI · card</small>
                    </button>
                    <button type="button" className={`pay-opt ${payMethod === "counter" ? "on" : ""}`} onClick={() => setPayMethod("counter")}>
                      <span>🪙</span><b>{delivery ? "On delivery" : t("checkout.payCounter")}</b><small>cash · UPI</small>
                    </button>
                    {me?.company && !table && (
                      <button type="button" className={`pay-opt ${payMethod === "company" ? "on" : ""}`} onClick={() => setPayMethod("company")}>
                        <span>🏢</span><b>{me.company.name} tab</b><small>{me.company.limit ? `${rupees(Math.max(0, me.company.limit - me.company.spent))} left this month` : "invoiced monthly"}</small>
                      </button>
                    )}
                  </div>
                </div>
              )}
              {!table && lines.some((l) => { const m = find(l.itemId); return m && ["coffee", "tea", "cold"].includes(m.cat) && !m.groups?.length; }) && (
                <label className="row small" style={{ alignItems: "center", gap: "0.5rem" }}>
                  <input type="checkbox" checked={ownCup} onChange={(e) => setOwnCup(e.target.checked)} /> ♻️ I&apos;ll bring my own cup <span className="muted">(₹10 off each drink)</span>
                </label>
              )}
              <label className="field">Anything we should know?<textarea className="input" rows={2} maxLength={200} placeholder="Allergies, a name for the cup…" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
            </div>
            <div className="drawer-foot">
              {summary}
              {error && <p className="error">{error}</p>}
              <button className="btn btn-pink full" disabled={busy || (delivery && (!terms || q.total < terms.minOrder)) || (rush === "paused" && !table)}>
                {busy ? "Placing order…" : later && mode === "pickup" && !table ? `Save for tomorrow · ${form.pickup}` : q.due === 0 ? "Place order (covered ✿)" : payMethod === "online" ? `${t("checkout.payNow")} · ${rupees(q.due)}` : t("checkout.place")}
              </button>
            </div>
          </form>
        )}
      </aside>
    </>
  );
}
