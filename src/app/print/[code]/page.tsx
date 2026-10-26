"use client";
import "./page.css";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { QuoteLine } from "@/lib/pricing";

type O = { code: string; name: string; pickup: string; table_no: number | null; delivery_address: string | null; note: string; lines: QuoteLine[]; created_at: string; pay_status: string };

// Kitchen ticket for an 80 mm receipt printer (or any printer). Opens the print dialog by itself.
export default function KitchenTicket() {
  const { code } = useParams<{ code: string }>();
  const [o, setO] = useState<O | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("printing-ticket");
    fetch(`/api/orders/${code}`).then((r) => r.json()).then((d) => d.code && setO(d)).catch(() => {});
    return () => document.documentElement.classList.remove("printing-ticket");
  }, [code]);
  useEffect(() => {
    if (!o) return;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [o]);

  if (!o) return <p className="kt">Loading…</p>;
  const where = o.table_no ? `TABLE ${o.table_no}` : o.delivery_address ? "DELIVERY" : o.pickup === "asap" ? "PICKUP · ASAP" : `PICKUP · ${o.pickup}`;
  return (
    <div className="kt">
      <div className="kt-head">
        <strong className="kt-code">{o.code}</strong>
        <span>{o.created_at.slice(11, 16)}</span>
      </div>
      <div className="kt-where">{where}</div>
      <div>{o.name}{o.pay_status === "paid" ? " · PAID" : " · NOT PAID"}</div>
      {o.delivery_address && <div className="kt-small">{o.delivery_address}</div>}
      <hr />
      {o.lines.map((l, i) => (
        <div key={i} className="kt-line">
          <b>{l.qty} ×</b> {l.name}
          {l.note && <div className="kt-small">{l.note}</div>}
        </div>
      ))}
      {o.note && (<><hr /><div className="kt-note">NOTE: {o.note}</div></>)}
      <hr />
      <button className="kt-btn" onClick={() => window.print()}>Print again</button>
    </div>
  );
}
