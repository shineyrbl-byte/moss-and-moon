"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ORDER_STEPS, type OrderStatus } from "@/lib/cafe";
import { rupees, type QuoteLine } from "@/lib/pricing";
import { usePay } from "@/components/Payment";
import { useStore } from "@/components/Store";
import { rememberOrder } from "@/lib/history";

type Order = {
  code: string; name: string; pickup: string; note: string; lines: QuoteLine[];
  subtotal: number; discount: number; total: number; promo: string | null; status: OrderStatus; created_at: string;
  pay_method: string; pay_status: "unpaid" | "pending" | "paid"; giftcard_used: number; happy_hour: number; ahead: number;
};

const STEP_INFO: Record<OrderStatus, { icon: string; label: string; msg: string }> = {
  received: { icon: "📝", label: "Received", msg: "We've got your order and it's next in line." },
  brewing: { icon: "☕", label: "Brewing", msg: "Our barista is making it with love right now." },
  ready: { icon: "🌸", label: "Ready", msg: "It's ready! Come grab it from the pink counter." },
  collected: { icon: "✓", label: "Collected", msg: "Enjoy every sip. See you again soon ☾" },
};

export default function OrderPage() {
  const { code } = useParams<{ code: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const lastStatus = useRef<string | null>(null);
  const pay = usePay();
  const { toast } = useStore();
  const [reload, setReload] = useState(0);
  const [paying, setPaying] = useState(false);

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
    const t = setInterval(load, 4000); // check for updates every few seconds
    return () => { alive = false; clearInterval(t); };
  }, [code, reload]);

  async function payNow() {
    setPaying(true);
    const ok = await pay("order", code);
    setPaying(false);
    if (ok) toast("Paid — thank you! ✿");
    setReload((r) => r + 1);
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

  const idx = ORDER_STEPS.indexOf(order.status);
  const info = STEP_INFO[order.status];

  return (
    <div className="page">
      <p className="eyebrow">order {order.code}</p>
      <h1 style={{ fontSize: "clamp(2.4rem, 6vw, 4rem)" }}>
        {order.status === "ready" ? <>It&apos;s <em>ready</em>, {order.name}!</> : <>Thanks, <em>{order.name}</em></>}
      </h1>
      <p className="lead">{info.msg}</p>
      {order.status !== "ready" && order.status !== "collected" && (
        <p className="small muted" style={{ marginTop: "0.5rem" }}>
          ⏱ {order.ahead === 0 ? "You're next in line" : `${order.ahead} order${order.ahead === 1 ? "" : "s"} ahead of you`} · about {5 + order.ahead * 3} min
        </p>
      )}

      {order.pay_status !== "paid" && order.total - order.giftcard_used > 0 && (
        <div className="pay-banner card">
          <div>
            <strong>{order.pay_status === "pending" ? "Payment not finished" : "Paying at the counter"}</strong>
            <p className="small muted">Skip the queue at the till: pay {rupees(order.total - order.giftcard_used)} online now.</p>
          </div>
          <button className="btn btn-pink btn-sm" onClick={payNow} disabled={paying}>{paying ? "Opening…" : "Pay now"}</button>
        </div>
      )}

      <div className="track card" style={{ marginTop: "2rem" }}>
        <div className="steps">
          <div className="bar" style={{ width: `${(idx / (ORDER_STEPS.length - 1)) * 75}%` }} />
          {ORDER_STEPS.map((s, i) => (
            <div key={s} className={`step ${i <= idx ? "done" : ""} ${i === idx && s !== "collected" ? "current" : ""}`}>
              <span className="circle">{STEP_INFO[s].icon}</span>
              {STEP_INFO[s].label}
            </div>
          ))}
        </div>

        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <span className="muted">Pickup: <strong>{order.pickup === "asap" ? "as soon as possible" : order.pickup}</strong></span>
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
          {order.discount > 0 && <div className="sum-row discount"><span>Discounts{order.promo ? ` (${order.promo})` : ""}{order.happy_hour ? " · golden hour" : ""}</span><span>−{rupees(order.discount)}</span></div>}
          {order.giftcard_used > 0 && <div className="sum-row discount"><span>Gift card</span><span>−{rupees(order.giftcard_used)}</span></div>}
          <div className="sum-row total">
            <span>{order.pay_status === "paid" ? "Paid ✓" : "Pay at pickup"}</span>
            <span>{rupees(order.total - order.giftcard_used)}</span>
          </div>
        </div>
      </div>

      <p className="small muted center" style={{ marginTop: "1.5rem" }}>
        This page updates by itself. Bookmark it, or show the code at the counter.
      </p>
      <div className="row" style={{ justifyContent: "center", marginTop: "1rem" }}>
        <Link href="/orders" className="btn btn-ghost btn-sm">My orders</Link>
        <Link href="/loyalty" className="btn btn-ghost btn-sm">See my stamp card</Link>
        <Link href="/#menu" className="btn btn-sm">Order something else</Link>
      </div>
    </div>
  );
}
