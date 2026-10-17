"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import MenuEditor from "@/components/admin/MenuEditor";
import TablesQR from "@/components/admin/TablesQR";
import { ORDER_STEPS, type OrderStatus } from "@/lib/cafe";
import { rupees, type QuoteLine } from "@/lib/pricing";
import { useStore } from "@/components/Store";

type Stats = {
  todayOrders: number; todayRevenue: number; activeOrders: number; bookingsToday: number; guestsToday: number;
  rating: number | null; reviewCount: number; subscribers: number; members: number; allTimeOrders: number; allTimeRevenue: number;
  giftCards: number; giftSold: number; giftOutstanding: number; paidOnline: number;
  top: { name: string; qty: number }[]; days: { day: string; label: string; revenue: number; orders: number }[];
};
type Order = { id: number; code: string; name: string; phone: string; table_no: number | null; email: string | null; pickup: string; note: string; lines: QuoteLine[]; total: number; giftcard_used: number; pay_method: string; pay_status: string; status: OrderStatus; created_at: string };
type Gift = { code: string; amount: number; balance: number; from_name: string; to_name: string; to_email: string; paid: number; created_at: string };
type Email = { id: number; to_email: string; subject: string; html: string; status: string; error: string | null; created_at: string };
type Booking = { id: number; code: string; name: string; phone: string; date: string; time: string; guests: number; note: string; status: string };
type Review = { id: number; name: string; rating: number; text: string; created_at: string };

const TABS = ["Overview", "Orders", "Bookings", "Menu", "Tables & QR", "Gift cards", "Emails", "Reviews"] as const;

// A soft two-note "ding" when a new order arrives
function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = "sine";
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.65);
    });
  } catch {}
}
const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export default function AdminPage() {
  const { toast } = useStore();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pass, setPass] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [mail, setMail] = useState<{ emails: Email[]; emailMode: string; paymentMode: string } | null>(null);
  const [preview, setPreview] = useState<Email | null>(null);
  const lastMaxId = useRef<number | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/stats");
    if (r.status === 401) return setAuthed(false);
    setAuthed(true);
    setStats(await r.json());
    const [o, b, rv, gc, em] = await Promise.all([
      fetch(`/api/orders${showDone ? "" : "?active=1"}`).then((r) => r.json()),
      fetch("/api/bookings").then((r) => r.json()),
      fetch("/api/reviews").then((r) => r.json()),
      fetch("/api/giftcards").then((r) => r.json()),
      fetch("/api/admin/emails").then((r) => r.json()),
    ]);
    // New order since last check? Play the chime.
    const maxId = Math.max(0, ...(o as Order[]).map((x) => x.id));
    if (lastMaxId.current !== null && maxId > lastMaxId.current) chime();
    lastMaxId.current = maxId;
    document.title = `(${(o as Order[]).filter((x) => x.status === "received").length}) Staff · Moss & Moon`;
    setOrders(o);
    setGifts(gc);
    setMail(em);
    setBookings(b);
    setReviews(rv.reviews);
  }, [showDone]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000); // keep the dashboard fresh
    return () => clearInterval(t);
  }, [load]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/login", json("POST", { passcode: pass }));
    if (!r.ok) return setLoginErr((await r.json()).error);
    setPass("");
    load();
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthed(false);
  }

  async function advance(o: Order) {
    const next = ORDER_STEPS[ORDER_STEPS.indexOf(o.status) + 1];
    if (!next) return;
    await fetch(`/api/orders/${o.code}`, json("PATCH", { status: next }));
    toast(`${o.code} → ${next}`);
    load();
  }

  async function setBooking(b: Booking, status: string) {
    await fetch("/api/bookings", json("PATCH", { code: b.code, status }));
    load();
  }


  async function deleteReview(id: number) {
    await fetch(`/api/reviews/${id}`, { method: "DELETE" });
    load();
  }

  if (authed === null) return <div className="page center muted">Loading…</div>;

  if (!authed)
    return (
      <div className="page" style={{ maxWidth: "26rem" }}>
        <p className="eyebrow">staff only</p>
        <h1 style={{ fontSize: "3rem" }}>Behind the <em>counter</em></h1>
        <form className="card" style={{ padding: "1.5rem", marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.8rem" }} onSubmit={login}>
          <label className="field">Passcode<input className="input" type="password" autoFocus value={pass} onChange={(e) => setPass(e.target.value)} /></label>
          {loginErr && <p className="error small">{loginErr}</p>}
          <button className="btn btn-pink">Log in</button>
          <p className="small muted">Default passcode is <code>moonlight</code> — change it with ADMIN_PASSCODE in .env.local</p>
        </form>
      </div>
    );

  const maxDay = Math.max(1, ...(stats?.days.map((d) => d.revenue) ?? [1]));
  const maxTop = Math.max(1, ...(stats?.top.map((t) => t.qty) ?? [1]));

  return (
    <div className="admin">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p className="eyebrow">staff dashboard</p>
          <h1 style={{ fontSize: "clamp(2.2rem, 5vw, 3.4rem)" }}>Good day, <em>barista</em> ☕</h1>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={logout}>Log out</button>
      </div>

      <div className="admin-tabs">
        {TABS.map((t) => (
          <button key={t} className={`chip ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>
            {t}{t === "Orders" && stats?.activeOrders ? ` (${stats.activeOrders})` : ""}
          </button>
        ))}
      </div>

      {tab === "Overview" && stats && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {mail && (
            <div className="mode-banner">
              <span>💳 Payments: <b>{mail.paymentMode === "razorpay" ? "Razorpay (live)" : "demo mode"}</b></span>
              <span>✉️ Emails: <b>{mail.emailMode === "live" ? "sending via Resend" : "preview only (see Emails tab)"}</b></span>
              <span>🔔 A chime plays when a new order comes in, so keep this tab open.</span>
            </div>
          )}
          <div className="kpis">
            <div className="kpi card"><span>Orders today</span><strong>{stats.todayOrders}</strong></div>
            <div className="kpi card"><span>Revenue today</span><strong>{rupees(stats.todayRevenue)}</strong></div>
            <div className="kpi card"><span>In the queue</span><strong>{stats.activeOrders}</strong></div>
            <div className="kpi card"><span>Bookings today</span><strong>{stats.bookingsToday}</strong><small className="muted">{stats.guestsToday} guests</small></div>
            <div className="kpi card"><span>Rating</span><strong>{stats.rating ?? "–"} ★</strong><small className="muted">{stats.reviewCount} reviews</small></div>
            <div className="kpi card"><span>Stamp members</span><strong>{stats.members}</strong></div>
            <div className="kpi card"><span>Newsletter</span><strong>{stats.subscribers}</strong></div>
            <div className="kpi card"><span>Paid online</span><strong>{stats.paidOnline}</strong><small className="muted">orders</small></div>
            <div className="kpi card"><span>Gift cards sold</span><strong>{rupees(stats.giftSold)}</strong><small className="muted">{stats.giftCards} cards · {rupees(stats.giftOutstanding)} unspent</small></div>
            <div className="kpi card"><span>All-time revenue</span><strong>{rupees(stats.allTimeRevenue)}</strong><small className="muted">{stats.allTimeOrders} orders</small></div>
          </div>
          <div className="row" style={{ alignItems: "stretch" }}>
            <div className="card" style={{ padding: "1.5rem", flex: "1 1 320px" }}>
              <h3>Last 7 days</h3>
              <div className="week">
                {stats.days.map((d) => (
                  <div key={d.day} title={`${rupees(d.revenue)} · ${d.orders} orders`}>
                    <small>{d.revenue ? rupees(d.revenue) : ""}</small>
                    <i style={{ height: `${(d.revenue / maxDay) * 100}%` }} />
                    {d.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{ padding: "1.5rem", flex: "1 1 320px" }}>
              <h3 style={{ marginBottom: "1rem" }}>Best sellers</h3>
              {!stats.top.length && <p className="muted">No orders yet.</p>}
              <div className="bars">
                {stats.top.map((t) => (
                  <div key={t.name} className="bar-row">
                    <span>{t.name}</span>
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${(t.qty / maxTop) * 100}%` }} /></div>
                    <strong>{t.qty}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "Orders" && (
        <>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <label className="small muted" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show collected orders too
            </label>
            <a className="btn btn-ghost btn-sm" href="/api/orders?format=csv">⬇ Download all orders (CSV)</a>
          </div>
          {!orders.length && <p className="muted">No orders in the queue. Time for a coffee yourself ☕</p>}
          <div className="order-cards">
            {orders.map((o) => {
              const next = ORDER_STEPS[ORDER_STEPS.indexOf(o.status) + 1];
              return (
                <div key={o.code} className="order-card card">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <strong>{o.code}</strong>
                    <span>
                      <span className={`status-tag ${o.pay_status}`}>{o.pay_status === "paid" ? (o.pay_method === "giftcard" ? "gift card" : "paid") : o.pay_status === "pending" ? "awaiting payment" : "pay at counter"}</span>{" "}
                      <span className={`status-tag ${o.status}`}>{o.status}</span>
                    </span>
                  </div>
                  {o.table_no && <span className="table-tag">🪑 Table {o.table_no}: bring it over</span>}
                  <span className="small muted">{o.name}{o.phone ? ` · ${o.phone}` : ""} · {o.table_no ? "dine-in" : `pickup ${o.pickup === "asap" ? "ASAP" : o.pickup}`} · {o.created_at.slice(11, 16)}</span>
                  <ul>
                    {o.lines.map((l, i) => <li key={i}>{l.qty} × {l.name}{l.note && <small className="muted"> ({l.note})</small>}</li>)}
                  </ul>
                  {o.note && <span className="small">📝 {o.note}</span>}
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <strong>{rupees(o.total - o.giftcard_used)}</strong>
                    {next && <button className="btn btn-pink btn-sm" onClick={() => advance(o)}>Mark {next} →</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "Bookings" && (
        <div className="card table-wrap" style={{ padding: "1rem" }}>
          {!bookings.length ? <p className="muted">No upcoming bookings.</p> : (
            <table className="table">
              <thead><tr><th>Date</th><th>Time</th><th>Name</th><th>Guests</th><th>Phone</th><th>Note</th><th>Status</th><th /></tr></thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.code} style={{ opacity: b.status === "cancelled" ? 0.45 : 1 }}>
                    <td>{b.date}</td><td>{b.time}</td><td>{b.name}<br /><small className="muted">{b.code}</small></td><td>{b.guests}</td><td>{b.phone}</td><td>{b.note}</td>
                    <td><span className="status-tag">{b.status}</span></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {b.status === "confirmed" && <>
                        <button className="chip" onClick={() => setBooking(b, "seated")}>Seat</button>{" "}
                        <button className="chip" onClick={() => setBooking(b, "cancelled")}>Cancel</button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "Menu" && <MenuEditor />}
      {tab === "Tables & QR" && <TablesQR />}

      {tab === "Gift cards" && (
        <div className="card table-wrap" style={{ padding: "1rem" }}>
          {!gifts.length ? <p className="muted">No gift cards yet.</p> : (
            <table className="table">
              <thead><tr><th>Code</th><th>From → To</th><th>Amount</th><th>Balance</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>
                {gifts.map((g) => (
                  <tr key={g.code}>
                    <td><code>{g.code}</code></td><td>{g.from_name} → {g.to_name}<br /><small className="muted">{g.to_email}</small></td>
                    <td>{rupees(g.amount)}</td><td>{rupees(g.balance)}</td>
                    <td><span className={`status-tag ${g.paid ? "paid" : "pending"}`}>{g.paid ? "active" : "unpaid"}</span></td>
                    <td>{g.created_at.slice(0, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "Emails" && mail && (
        <>
          <p className="muted" style={{ marginBottom: "1rem" }}>
            {mail.emailMode === "live"
              ? "Emails are being sent through Resend."
              : "Emails are saved here but not sent yet. Add a RESEND_API_KEY to start sending them (see DEPLOY.md)."}
          </p>
          <div className="email-layout">
            <div className="card" style={{ padding: "0.5rem" }}>
              {!mail.emails.length && <p className="muted" style={{ padding: "1rem" }}>No emails yet.</p>}
              {mail.emails.map((e) => (
                <button key={e.id} className={`email-row ${preview?.id === e.id ? "on" : ""}`} onClick={() => setPreview(e)}>
                  <strong>{e.subject}</strong>
                  <small className="muted">{e.to_email} · {e.created_at.slice(5, 16)} · <span className={e.status === "failed" ? "error" : ""}>{e.status}</span></small>
                </button>
              ))}
            </div>
            <div className="card email-preview">
              {preview ? <iframe title="Email preview" srcDoc={preview.html} sandbox="" /> : <p className="muted" style={{ padding: "1.5rem" }}>Pick an email to preview it.</p>}
              {preview?.error && <p className="error small" style={{ padding: "0 1rem 1rem" }}>{preview.error}</p>}
            </div>
          </div>
        </>
      )}

      {tab === "Reviews" && (
        <div className="reviews" style={{ marginTop: 0 }}>
          {reviews.map((r) => (
            <article key={r.id} className="review card">
              <span className="stars">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
              <p style={{ fontSize: "1.05rem" }}>“{r.text}”</p>
              <footer style={{ justifyContent: "space-between" }}>
                <span>{r.name} · {r.created_at.slice(0, 10)}</span>
                <button className="chip" onClick={() => deleteReview(r.id)}>Remove</button>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
