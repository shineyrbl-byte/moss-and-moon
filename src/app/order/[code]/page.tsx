"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ORDER_STEPS, type OrderStatus } from "@/lib/cafe";
import { orderDue, rupees, type QuoteLine } from "@/lib/pricing";
import { usePay } from "@/components/Payment";
import { useStore } from "@/components/Store";
import { rememberOrder } from "@/lib/history";
import NotifyButton from "@/components/NotifyButton";
import InstallButton from "@/components/InstallButton";
import { useLive } from "@/components/useLive";

type Order = {
  code: string; name: string; pickup: string; note: string; lines: QuoteLine[];
  subtotal: number; discount: number; total: number; promo: string | null; status: OrderStatus; created_at: string;
  pay_method: string; pay_status: "unpaid" | "pending" | "paid"; giftcard_used: number; happy_hour: number; ahead: number; table_no: number | null;
  tip: number; credit_used: number; delivery_fee: number; delivery_address: string | null; split_count: number | null; perks: string | null; paidShares: number;
};

const STEP_INFO: Record<OrderStatus, { icon: string; label: string; msg: string }> = {
  received: { icon: "📝", label: "Received", msg: "We've got your order and it's next in line." },
  brewing: { icon: "☕", label: "Brewing", msg: "Our barista is making it with love right now." },
  ready: { icon: "🌸", label: "Ready", msg: "It's ready! Come grab it from the pink counter." },
  collected: { icon: "✓", label: "Collected", msg: "Enjoy every sip. See you again soon ☾" },
};
const DELIVERY_INFO: Partial<Record<OrderStatus, { icon: string; label: string; msg: string }>> = {
  ready: { icon: "🛵", label: "On its way", msg: "It's out for delivery, so keep your phone close ✿" },
  collected: { icon: "✓", label: "Delivered", msg: "Delivered! Enjoy every sip ☾" },
};

export default function OrderPage() {
  const { code } = useParams<{ code: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const lastStatus = useRef<string | null>(null);
  const pay = usePay();
  const { toast, t } = useStore();
  const [reload, setReload] = useState(0);
  const [paying, setPaying] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/orders/${code}`)
        .then(async (r) => {
          const d = await r.json();
          if (!alive) return;
          if (!r.ok) return setError(d.error);
          // A little buzz when the order becomes ready (phones only)
          if (lastStatus.current && lastStatus.current !== "ready" && d.status === "ready") navigator.vibrate?.(200);
          lastStatus.current = d.status;
          setOrder(d);
          rememberOrder(d.code);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 20000); // backup check; live updates arrive instantly below
    return () => { alive = false; clearInterval(t); };
  }, [code, reload]);

  useLive(`/api/live?topic=order&code=${encodeURIComponent(code)}`, () => setReload((r) => r + 1));

  async function payNow(kind: "order" | "share") {
    setPaying(true);
    const ok = await pay(kind, code);
    setPaying(false);
    if (ok) toast(kind === "share" ? "Your share is paid ✿" : "Paid — thank you! ✿");
    setReload((r) => r + 1);
  }

  async function split(count: number) {
    const r = await fetch(`/api/orders/${code}/split`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setSplitOpen(false);
    setReload((x) => x + 1);
  }

  async function shareLink() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: "Our Moss & Moon bill", text: "Pay your share here ✿", url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Link copied: send it to your friends ✿");
      }
    } catch {}
  }

  if (error)
    return (
      <div className="page center">
        <h2>Hmm, <em>no order</em> here</h2>
        <p className="lead">{error}</p>
        <Link href="/#menu" className="btn" style={{ marginTop: "1.5rem" }}>Back to the menu</Link>
      </div>
    );
  if (!order) return <div className="page center"><p className="muted">Finding your order…</p></div>;

  const isDelivery = !!order.delivery_address;
  const step = (s: OrderStatus) => (isDelivery && DELIVERY_INFO[s]) || STEP_INFO[s];
  const idx = ORDER_STEPS.indexOf(order.status);
  const info =
    order.table_no && order.status === "ready" ? { ...STEP_INFO.ready, msg: `It's ready, and on its way to table ${order.table_no} ✿` } : step(order.status);

  const due = orderDue(order);
  const left = Math.max(0, due - order.paidShares);
  const unpaid = order.pay_status !== "paid" && left > 0;
  const share = order.split_count ? Math.ceil(due / order.split_count) : 0;
  const sharesPaid = order.split_count ? Math.round(order.paidShares / share) : 0;
  const payLabel = isDelivery ? "Pay on delivery" : order.table_no ? "Pay at the table" : "Pay at pickup";

  return (
    <div className="page">
      <p className="eyebrow">order {order.code}</p>
      <h1 style={{ fontSize: "clamp(2.4rem, 6vw, 4rem)" }}>
        {order.status === "ready" && !isDelivery ? <>It&apos;s <em>ready</em>, {order.name}!</> : <>{t("order.thanks")} <em>{order.name}</em></>}
      </h1>
      <p className="lead">{info.msg}</p>
      {order.status !== "ready" && order.status !== "collected" && (
        <p className="small muted" style={{ marginTop: "0.5rem" }}>
          ⏱ {order.ahead === 0 ? "You're next in line" : `${order.ahead} order${order.ahead === 1 ? "" : "s"} ahead of you`} · about {5 + order.ahead * 3 + (isDelivery ? 20 : 0)} min
        </p>
      )}
      {order.status !== "collected" && (
        <div className="row" style={{ marginTop: "1rem", alignItems: "center" }}>
          {order.status !== "ready" && <NotifyButton code={order.code} />}
          <InstallButton />
        </div>
      )}

      {unpaid && (
        <div className="pay-banner card">
          {order.split_count ? (
            <>
              <div>
                <strong>Split {order.split_count} ways · {rupees(share)} each</strong>
                <p className="small muted">{sharesPaid} of {order.split_count} paid · {rupees(left)} left. Everyone can pay from this page on their own phone.</p>
              </div>
              <div className="row">
                <button className="btn btn-ghost btn-sm" onClick={shareLink}>🔗 Send link</button>
                <button className="btn btn-pink btn-sm" onClick={() => payNow("share")} disabled={paying}>{paying ? "Opening…" : `Pay my share (${rupees(Math.min(share, left))})`}</button>
              </div>
            </>
          ) : (
            <>
              <div>
                <strong>{order.pay_status === "pending" ? "Payment not finished" : payLabel}</strong>
                <p className="small muted">Skip the till: pay {rupees(left)} online now{order.table_no || due >= 300 ? ", or split it with friends" : ""}.</p>
              </div>
              <div className="row">
                <button className="btn btn-ghost btn-sm" onClick={() => setSplitOpen((v) => !v)}>👯 Split the bill</button>
                <button className="btn btn-pink btn-sm" onClick={() => payNow("order")} disabled={paying}>{paying ? "Opening…" : "Pay now"}</button>
              </div>
            </>
          )}
          {splitOpen && !order.split_count && (
            <div className="split-picker">
              <span className="small">Split between</span>
              {[2, 3, 4, 5, 6].map((n) => (
                <button key={n} className="chip" onClick={() => split(n)}>{n} people · {rupees(Math.ceil(due / n))}</button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="track card" style={{ marginTop: "2rem" }}>
        <div className="steps">
          <div className="bar" style={{ width: `${(idx / (ORDER_STEPS.length - 1)) * 75}%` }} />
          {ORDER_STEPS.map((s, i) => (
            <div key={s} className={`step ${i <= idx ? "done" : ""} ${i === idx && s !== "collected" ? "current" : ""}`}>
              <span className="circle">{step(s).icon}</span>
              {isDelivery && DELIVERY_INFO[s] ? step(s).label : t(`order.${s}` as "order.ready")}
            </div>
          ))}
        </div>

        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <span className="muted">
            {isDelivery ? <>🛵 Delivering to <strong>{order.delivery_address}</strong></> : order.table_no ? <>🪑 Bringing it to <strong>table {order.table_no}</strong></> : <>Pickup: <strong>{order.pickup === "asap" ? "as soon as possible" : order.pickup}</strong></>}
          </span>
          <span className="code">{order.code}</span>
        </div>

        {order.lines.map((l, i) => (
          <div key={i} className="sum-row" style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--line)" }}>
            <span>{l.qty} × {l.name}{l.note && <small className="muted"> · {l.note}</small>}</span>
            <span>{rupees(l.total)}</span>
          </div>
        ))}
        {order.note && <p className="small muted" style={{ marginTop: "0.6rem" }}>Note: {order.note}</p>}
        <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {order.discount > 0 && (
            <div className="sum-row discount">
              <span>Discounts{order.promo ? ` (${order.promo})` : ""}{order.happy_hour ? " · golden hour" : ""}{order.perks ? ` · ${order.perks.replace("stamps", "free drink").replace("pass", "coffee pass").replace(/,/g, ", ")}` : ""}</span>
              <span>−{rupees(order.discount)}</span>
            </div>
          )}
          {order.credit_used > 0 && <div className="sum-row discount"><span>Your credit</span><span>−{rupees(order.credit_used)}</span></div>}
          {order.giftcard_used > 0 && <div className="sum-row discount"><span>Gift card</span><span>−{rupees(order.giftcard_used)}</span></div>}
          {order.delivery_fee > 0 && <div className="sum-row"><span>Delivery</span><span>{rupees(order.delivery_fee)}</span></div>}
          {order.tip > 0 && <div className="sum-row"><span>Tip for the team 💛</span><span>{rupees(order.tip)}</span></div>}
          <div className="sum-row total">
            <span>{order.pay_status === "paid" ? "Paid ✓" : payLabel}</span>
            <span>{rupees(due)}</span>
          </div>
        </div>
      </div>

      <p className="small muted center" style={{ marginTop: "1.5rem" }}>
        This page updates by itself. Bookmark it, or show the code at the counter.
      </p>
      <div className="row" style={{ justifyContent: "center", marginTop: "1rem" }}>
        <Link href="/orders" className="btn btn-ghost btn-sm">My orders</Link>
        <Link href="/account" className="btn btn-ghost btn-sm">My account</Link>
        <Link href="/#menu" className="btn btn-sm">Order something else</Link>
      </div>
    </div>
  );
}
