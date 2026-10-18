"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { rupees } from "@/lib/pricing";
import { useStore } from "@/components/Store";
import type { CafeEvent } from "@/lib/cafe";

type Ticket = { code: string; name: string; qty: number; amount: number; paid: boolean; checkedIn: boolean; checkedInAt: string | null; event: CafeEvent | null };

export default function TicketPage() {
  const { code } = useParams<{ code: string }>();
  const { toast } = useStore();
  const [t, setT] = useState<Ticket | null>(null);
  const [error, setError] = useState("");
  const [staff, setStaff] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    fetch(`/api/tickets/${code}`).then(async (r) => {
      const d = await r.json();
      if (!r.ok) return setError(d.error);
      setT(d);
    }).catch(() => setError("Couldn't load the ticket."));
  }, [code, reload]);
  // Staff who scan the QR code get a "Check in" button
  useEffect(() => {
    fetch("/api/admin/me").then((r) => setStaff(r.ok)).catch(() => {});
  }, []);

  async function checkIn() {
    const r = await fetch(`/api/tickets/${code}`, { method: "PATCH" });
    const d = await r.json();
    toast(r.ok ? `Welcome in, ${d.name}${d.qty > 1 ? ` (+${d.qty - 1})` : ""} ✿` : d.error);
    setReload((x) => x + 1);
  }

  if (error)
    return (
      <div className="page center">
        <h2>Hmm, <em>no ticket</em> here</h2>
        <p className="lead">{error}</p>
        <Link href="/#events" className="btn" style={{ marginTop: "1.5rem" }}>See events</Link>
      </div>
    );
  if (!t) return <div className="page center"><p className="muted">Finding your ticket…</p></div>;
  const ev = t.event;
  const when = ev ? new Date(`${ev.date}T${ev.time}`) : null;

  return (
    <div className="page narrow">
      <div className={`ticket card ${t.checkedIn ? "used" : ""}`}>
        <div className="ticket-top">
          <p className="eyebrow" style={{ margin: 0 }}>ticket {t.code}</p>
          <h1 className="h2" style={{ margin: "0.3rem 0" }}>{ev?.title ?? "Event"}</h1>
          {when && (
            <p className="lead" style={{ margin: 0 }}>
              {when.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · {when.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
            </p>
          )}
          <p className="muted">14 Willow Lane · {t.name}{t.qty > 1 ? ` + ${t.qty - 1}` : ""}</p>
        </div>
        <div className="ticket-stub">
          {t.paid ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/tickets/${t.code}/qr`} alt={`QR code for ticket ${t.code}`} width={200} height={200} />
              <strong>{t.qty} {t.qty === 1 ? "ticket" : "tickets"} · {rupees(t.amount)} paid</strong>
              {t.checkedIn ? <span className="success">✓ Checked in at {t.checkedInAt?.slice(11, 16)}</span> : <span className="small muted">Show this at the door</span>}
            </>
          ) : (
            <p className="error">This ticket hasn&apos;t been paid for yet.</p>
          )}
        </div>
      </div>
      {staff && t.paid && !t.checkedIn && (
        <button className="btn btn-pink full" style={{ marginTop: "1rem" }} onClick={checkIn}>✓ Check in at the door</button>
      )}
      <div className="row" style={{ justifyContent: "center", marginTop: "1.2rem" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>🖨 Print</button>
        <Link href="/#events" className="btn btn-ghost btn-sm">More events</Link>
      </div>
    </div>
  );
}
