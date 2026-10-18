"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useStore, type GroupRef } from "@/components/Store";
import { usePay } from "@/components/Payment";
import { useLive } from "@/components/useLive";
import { rupees, type Options } from "@/lib/pricing";

type Person = {
  person: string; subtotal: number; share: number; paid: number;
  items: { id: number; itemId: string; opts: Options; name: string; note: string; qty: number; price: number }[];
};
type Summary = {
  code: string; host: string; status: "open" | "placed"; orderCode: string | null; orderPaid: boolean;
  people: Person[]; subtotal: number; due: number; itemCount: number;
};

const post = (url: string, body: unknown, method = "POST") =>
  fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export default function GroupPage() {
  const { code: raw } = useParams<{ code: string }>();
  const code = raw.toUpperCase();
  const router = useRouter();
  const { group, setGroup, lines, clear, add, setDrawerOpen, me, toast } = useStore();
  const pay = usePay();
  const [s, setS] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  // Suggest a name from the account or the last order
  useEffect(() => {
    try { setName(me?.name || JSON.parse(localStorage.getItem("mm-me") || "{}").name || ""); } catch {}
  }, [me]);

  const isNew = code === "NEW";
  const [remembered, setRemembered] = useState<GroupRef | null>(null);
  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem("mm-groups") || "{}")[code];
      if (r?.person) setRemembered({ code, ...r });
    } catch {}
  }, [code, group]);
  const mine = group?.code === code ? group : remembered;

  // Once it's placed, stop adding new tray items to it
  useEffect(() => {
    if (s?.status === "placed" && group?.code === code) setGroup(null);
  }, [s?.status, group?.code, code, setGroup]);

  useEffect(() => {
    if (isNew) return;
    let alive = true;
    fetch(`/api/groups/${code}`)
      .then(async (r) => {
        const d = await r.json();
        if (!alive) return;
        if (!r.ok) return setError(d.error);
        setS(d);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [code, isNew, reload]);
  useLive(isNew ? null : `/api/live?topic=group&code=${encodeURIComponent(code)}`, () => setReload((r) => r + 1));

  // Start a new group (and bring along whatever is already in the tray)
  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await post("/api/groups", { name });
    const d = await r.json();
    if (!r.ok) { setBusy(false); return setError(d.error); }
    setGroup({ code: d.code, person: name.trim(), host: name.trim(), hostToken: d.hostToken });
    if (lines.length) {
      await post(`/api/groups/${d.code}/items`, { person: name.trim(), lines: lines.map(({ itemId, opts, qty }) => ({ itemId, opts, qty })) });
      clear();
    }
    setBusy(false);
    router.replace(`/g/${d.code}`);
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    if (!s || !name.trim()) return;
    setGroup({ code, person: name.trim().slice(0, 30), host: s.host, hostToken: remembered?.hostToken });
    toast(`You're in ${s.host}'s group ✿ Pick your drinks!`);
    router.push("/#menu");
  }

  async function remove(id: number) {
    if (!mine) return;
    const r = await post(`/api/groups/${code}/items`, { id, person: mine.person, hostToken: mine.hostToken }, "DELETE");
    if (!r.ok) toast((await r.json()).error);
  }

  // Host: load everyone's items into the tray and go to checkout
  const checkout = useCallback(() => {
    if (!s || !mine?.hostToken) return;
    clear();
    for (const p of s.people) for (const it of p.items) add(it.itemId, it.opts, it.qty);
    setGroup({ ...mine, checkout: true });
    setDrawerOpen(true);
  }, [s, mine, clear, add, setGroup, setDrawerOpen]);

  async function payMine() {
    if (!s?.orderCode || !mine) return;
    const ok = await pay("share", s.orderCode, { name: mine.person }, { person: mine.person });
    if (ok) toast("Your part is paid ✿ Thank you!");
    setReload((r) => r + 1);
  }

  async function share() {
    const url = `${window.location.origin}/g/${code}`;
    try {
      if (navigator.share) await navigator.share({ title: "Our Moss & Moon group order", text: "Add your drink to our order 👯", url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Link copied: send it to your friends ✿");
      }
    } catch {}
  }

  if (isNew)
    return (
      <div className="page narrow">
        <p className="eyebrow">group order</p>
        <h1 className="h2">Order <em>together</em> 👯</h1>
        <p className="lead">Start a shared tray, send the link, and everyone adds their own drink from their phone. You check out once, and each person can pay their own part.</p>
        <form className="card booking" onSubmit={start} style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          <label className="field">Your name<input className="input" required maxLength={30} value={name} onChange={(e) => setName(e.target.value)} /></label>
          {lines.length > 0 && <p className="small muted">The {lines.length} item{lines.length === 1 ? "" : "s"} in your tray will go in too.</p>}
          {error && <p className="error small">{error}</p>}
          <button className="btn btn-pink" disabled={busy}>{busy ? "Starting…" : "Start the group order"}</button>
        </form>
      </div>
    );

  if (error)
    return (
      <div className="page center">
        <h2>Hmm, <em>no group</em> here</h2>
        <p className="lead">{error}</p>
        <Link href="/g/new" className="btn" style={{ marginTop: "1.5rem" }}>Start a new one</Link>
      </div>
    );
  if (!s) return <div className="page center"><p className="muted">Finding the group…</p></div>;

  const me_ = s.people.find((p) => p.person === mine?.person);
  const myLeft = me_ ? Math.max(0, me_.share - me_.paid) : 0;

  return (
    <div className="page narrow">
      <p className="eyebrow">group order {s.code}</p>
      <h1 className="h2">{s.host}&apos;s <em>group order</em></h1>
      <p className="lead">
        {s.status === "placed"
          ? "Ordered! Everyone can pay their own part below."
          : `${s.people.length} ${s.people.length === 1 ? "person" : "people"} · ${s.itemCount} item${s.itemCount === 1 ? "" : "s"} so far. This page updates by itself.`}
      </p>

      {s.status === "open" && !mine && (
        <form className="card booking" onSubmit={join} style={{ marginTop: "1.5rem", display: "flex", gap: "0.7rem", flexWrap: "wrap", alignItems: "end" }}>
          <label className="field" style={{ flex: 1, minWidth: 180 }}>Your name<input className="input" required maxLength={30} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <button className="btn btn-pink">Join &amp; pick drinks</button>
        </form>
      )}

      {s.status === "open" && mine && (
        <div className="row" style={{ marginTop: "1.2rem" }}>
          <Link href="/#menu" className="btn btn-pink">+ Add drinks</Link>
          <button className="btn btn-ghost" onClick={share}>🔗 Invite friends</button>
          {mine.hostToken && <button className="btn" onClick={checkout} disabled={!s.itemCount}>Check out for everyone · {rupees(s.subtotal)}</button>}
        </div>
      )}
      {s.status === "open" && mine && !mine.hostToken && <p className="small muted" style={{ marginTop: "0.6rem" }}>{s.host} will check out when everyone&apos;s added their drinks.</p>}

      {s.status === "placed" && s.orderCode && (
        <div className="pay-banner card" style={{ marginTop: "1.2rem" }}>
          <div>
            <strong>Order {s.orderCode} {s.orderPaid ? "is fully paid ✓" : "is in the queue"}</strong>
            <p className="small muted">Total {rupees(s.due)}, shared by what each person ordered.</p>
          </div>
          <div className="row">
            <Link href={`/order/${s.orderCode}`} className="btn btn-ghost btn-sm">Track it</Link>
            {me_ && myLeft > 0 && !s.orderPaid && <button className="btn btn-pink btn-sm" onClick={payMine}>Pay my part ({rupees(myLeft)})</button>}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1.5rem" }}>
        {!s.people.length && <p className="muted center">The tray is empty. Add the first drink!</p>}
        {s.people.map((p) => (
          <section key={p.person} className="card group-person">
            <div className="sum-row" style={{ marginBottom: "0.4rem" }}>
              <h2 className="h3">{p.person}{p.person === s.host ? " · host" : ""}{p.person === mine?.person ? " (you)" : ""}</h2>
              <span>
                {s.status === "placed" ? (p.paid >= p.share ? <span className="success">Paid ✓</span> : <>{rupees(p.share)}</>) : rupees(p.subtotal)}
              </span>
            </div>
            {p.items.map((it) => (
              <div key={it.id} className="sum-row small" style={{ padding: "0.35rem 0", borderTop: "1px solid var(--line)" }}>
                <span>{it.qty} × {it.name}{it.note && <span className="muted"> · {it.note}</span>}</span>
                <span className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
                  {rupees(it.price)}
                  {s.status === "open" && mine && (p.person === mine.person || mine.hostToken) && (
                    <button className="link-btn" onClick={() => remove(it.id)} aria-label={`Remove ${it.name}`}>✕</button>
                  )}
                </span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
