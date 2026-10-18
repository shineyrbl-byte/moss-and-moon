"use client";
import Link from "next/link";
import NextShift from "@/components/NextShift";
import ClockButton from "@/components/ClockButton";
import { useCallback, useEffect, useRef, useState } from "react";
import { ORDER_STEPS, type OrderStatus } from "@/lib/cafe";
import { orderDue, rupees, type QuoteLine } from "@/lib/pricing";
import { useLive } from "@/components/useLive";
import SupportInbox from "@/components/SupportInbox";
import RecipeBook from "@/components/RecipeBook";
import { activeBranches, findBranch } from "@/lib/cafe";

type Order = {
  vip?: boolean;
  branch?: string;
  priority?: number;
  id: number; code: string; name: string; pickup: string; note: string; lines: QuoteLine[]; total: number; giftcard_used: number;
  pay_method: string; pay_status: string; status: OrderStatus; created_at: string; table_no: number | null;
  tip: number; credit_used: number; delivery_fee: number; delivery_address?: string | null;
};
type Call = { id: number; table_no: number; reason: string; created_at: string };

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = { received: "Start brewing", brewing: "Ready ✓", ready: "Handed over" };
const COLUMNS: { status: OrderStatus; title: string }[] = [
  { status: "received", title: "📝 New" },
  { status: "brewing", title: "☕ Brewing" },
  { status: "ready", title: "🌸 Ready" },
];
const CALL_LABEL: Record<string, string> = { help: "needs help", water: "would like water", bill: "wants the bill", order: "is ready to order" };

const minutesSince = (ts: string, now: number) => Math.max(0, Math.floor((now - new Date(ts.replace(" ", "T")).getTime()) / 60000));

function beep(kind: "order" | "call") {
  try {
    const ctx = new AudioContext();
    const notes = kind === "order" ? [880, 1320] : [520, 520, 520];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.55);
    });
  } catch {}
}

// Big-button order screen for the barista's tablet. Updates instantly.
export default function StaffScreen() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [now, setNow] = useState(Date.now());
  const [sound, setSound] = useState(true);
  const [awake, setAwake] = useState(false);
  const [recipe, setRecipe] = useState<{ itemId: string | null; note?: string } | null>(null);
  // With more than one café, each tablet can show just its own branch
  const [only, setOnly] = useState("all");
  useEffect(() => { try { setOnly(localStorage.getItem("mm-kds-branch") || "all"); } catch {} }, []);
  const pickBranch = (id: string) => { setOnly(id); try { localStorage.setItem("mm-kds-branch", id); } catch {} };
  const branches = activeBranches();
  const seen = useRef<Set<string> | null>(null);
  const seenCalls = useRef<Set<number> | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const lock = useRef<{ release: () => Promise<void> } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/orders?active=1");
    if (r.status === 401) return setAuthed(false);
    setAuthed(true);
    const list = (await r.json()) as Order[];
    const ids = new Set(list.map((o) => o.code));
    if (seen.current && [...ids].some((c) => !seen.current!.has(c)) && soundRef.current) beep("order");
    seen.current = ids;
    setOrders(list.reverse()); // oldest first: first in, first out

    const c = await fetch("/api/tables/call").then((x) => (x.ok ? x.json() : [])).catch(() => []);
    const callIds = new Set<number>((c as Call[]).map((x) => x.id));
    if (seenCalls.current && [...callIds].some((x) => !seenCalls.current!.has(x)) && soundRef.current) beep("call");
    seenCalls.current = callIds;
    setCalls(c);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    const c = setInterval(() => setNow(Date.now()), 15000);
    return () => { clearInterval(t); clearInterval(c); };
  }, [load]);
  useLive(authed ? "/api/live?topic=staff" : null, (e) => e.type !== "menu" && load());

  async function advance(o: Order) {
    const next = ORDER_STEPS[ORDER_STEPS.indexOf(o.status) + 1];
    setOrders((os) => os.map((x) => (x.code === o.code ? { ...x, status: next } : x)).filter((x) => x.status !== "collected"));
    await fetch(`/api/orders/${o.code}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
  }

  async function doneCall(c: Call) {
    setCalls((cs) => cs.filter((x) => x.id !== c.id));
    await fetch("/api/tables/call", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id }) });
  }

  async function toggleAwake() {
    try {
      if (lock.current) {
        await lock.current.release();
        lock.current = null;
        setAwake(false);
      } else {
        lock.current = await (navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request("screen");
        setAwake(true);
      }
    } catch {
      setAwake(false);
    }
  }

  if (authed === null) return <div className="page center muted">Loading…</div>;
  if (!authed)
    return (
      <div className="page center">
        <h1 className="h2">Staff only ☕</h1>
        <p className="lead">Log in on the dashboard first, then come back here.</p>
        <Link href="/admin" className="btn" style={{ marginTop: "1rem" }}>Go to staff login</Link>
      </div>
    );

  return (
    <div className="kds">
      {recipe && <RecipeBook itemId={recipe.itemId} note={recipe.note} onClose={() => setRecipe(null)} />}
      <header className="kds-head">
        <h1 className="logo" style={{ fontSize: "1.6rem" }}>Barista <span>screen</span></h1>
        <span className="muted small">{orders.length} open · updates instantly</span>
        <NextShift />
        <ClockButton />
        <div className="row" style={{ marginLeft: "auto" }}>
          <SupportInbox onNew={() => sound && beep("order")} />
          <button className="chip" onClick={() => setRecipe({ itemId: null })}>📖 Recipes</button>
          <button className={`chip ${sound ? "on" : ""}`} onClick={() => { setSound(!sound); if (!sound) beep("order"); }}>{sound ? "🔔 Sound on" : "🔕 Sound off"}</button>
          <button className={`chip ${awake ? "on" : ""}`} onClick={toggleAwake}>{awake ? "☀︎ Screen stays on" : "Keep screen on"}</button>
          <Link href="/admin" className="chip">Dashboard</Link>
        </div>
      </header>

      {branches.length > 1 && (
        <div className="chips" style={{ justifyContent: "flex-start", padding: "0 1rem" }} role="radiogroup" aria-label="Show orders for">
          {[{ id: "all", name: "All branches" }, ...branches].map((b) => <button key={b.id} role="radio" aria-checked={only === b.id} className={`chip ${only === b.id ? "on" : ""}`} onClick={() => pickBranch(b.id)}>{b.name}</button>)}
        </div>
      )}
      {calls.length > 0 && (
        <div className="kds-calls">
          {calls.map((c) => (
            <button key={c.id} className="kds-call" onClick={() => doneCall(c)}>
              🙋 <b>Table {c.table_no}</b> {CALL_LABEL[c.reason] ?? "needs you"} · {minutesSince(c.created_at, now)}m <span className="small">(tap when done)</span>
            </button>
          ))}
        </div>
      )}

      <div className="kds-cols">
        {COLUMNS.map((col) => {
          const list = orders.filter((o) => o.status === col.status && (only === "all" || (o.branch ?? "main") === only)).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)); // gold members first
          return (
            <section key={col.status} className={`kds-col ${col.status}`}>
              <h2>{col.title} <span>{list.length}</span></h2>
              {list.map((o) => {
                const mins = minutesSince(o.created_at, now);
                return (
                  <article key={o.code} className={`ticket ${mins >= 10 && o.status !== "ready" ? "late" : ""}`}>
                    <div className="ticket-top">
                      <strong>{o.code}{branches.length > 1 && only === "all" && <span className="branch-tag">{findBranch(o.branch).name}</span>}</strong>
                      <span className="ticket-time">{mins}m</span>
                    </div>
                    <div className="ticket-who">
                      {o.delivery_address ? <span className="table-tag">🛵 Delivery</span> : o.table_no ? <span className="table-tag">🪑 Table {o.table_no}</span> : <span className="ticket-pickup">🛍 {o.pickup === "asap" ? "ASAP" : o.pickup}</span>}
                      <span>{o.name}{o.vip ? <span className="vip-tag" title="A regular the owner starred"> ⭐ VIP</span> : null}{o.priority ? <span className="vip-tag" title="Gold member: make this one first"> 🥇 Gold</span> : null}</span>
                    </div>
                    <ul className="ticket-items">
                      {o.lines.map((l, i) => (
                        <li key={i}><b>{l.qty}×</b> <button className="recipe-link" onClick={() => setRecipe({ itemId: l.itemId, note: l.note })} title="How to make it">{l.name}</button>{l.note && <small>{l.note}</small>}</li>
                      ))}
                    </ul>
                    {o.note && <p className="ticket-note">📝 {o.note}</p>}
                    <div className="ticket-foot">
                      <span className={`status-tag ${o.pay_status}`}>{o.pay_status === "paid" ? "paid" : o.pay_status === "pending" ? "awaiting payment" : `collect ${rupees(orderDue(o))}`}</span>
                      <span className="row" style={{ gap: "0.4rem" }}>
                        <a className="btn btn-ghost" href={`/print/${o.code}`} target="_blank" rel="noreferrer" aria-label={`Print ticket for ${o.code}`}>🖨</a>
                        <button className="btn btn-pink" onClick={() => advance(o)}>{NEXT_LABEL[o.status]}</button>
                      </span>
                    </div>
                  </article>
                );
              })}
              {!list.length && <p className="muted small kds-empty">Nothing here ✿</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
