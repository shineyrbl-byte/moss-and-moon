"use client";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { photo } from "@/lib/menu";
import { rupees } from "@/lib/pricing";

type Gift = {
  code: string; itemId: string; itemName: string; img: string | null; note: string; amount: number; fromName: string; toName: string;
  message: string | null; paid: boolean; orderCode: string | null; redeemedAt: string | null; expires: string; expired: boolean; available: boolean;
};

function DrinkGift() {
  const { code } = useParams<{ code: string }>();
  const sent = useSearchParams().get("sent") === "1";
  const router = useRouter();
  const { toast, table } = useStore();
  const [g, setG] = useState<Gift | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", phone: "" });
  const [claiming, setClaiming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/drink-gifts/${code}`).then(async (r) => {
      const d = await r.json();
      if (!r.ok) return setError(d.error);
      setG(d);
      setForm((f) => ({ ...f, name: f.name || d.toName }));
    }).catch(() => setError("Couldn't load the gift."));
  }, [code]);

  async function claim(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch(`/api/drink-gifts/${code}/redeem`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, table }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) {
      if (d.orderCode) return router.push(`/order/${d.orderCode}`);
      return toast(d.error);
    }
    toast("It's on its way to the barista ☕");
    router.push(`/order/${d.orderCode}`);
  }

  async function share() {
    if (!g) return;
    const url = `${window.location.origin}/d/${g.code}`;
    const text = `☕ I bought you a ${g.itemName} at Moss & Moon! Claim it here:`;
    try {
      if (navigator.share) await navigator.share({ title: "A coffee for you", text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast("Link copied ✿");
      }
    } catch {}
  }

  if (error)
    return (
      <div className="page center">
        <h2>Hmm, <em>no gift</em> here</h2>
        <p className="lead">{error}</p>
        <Link href="/" className="btn" style={{ marginTop: "1.5rem" }}>Back to the café</Link>
      </div>
    );
  if (!g) return <div className="page center"><p className="muted">Unwrapping…</p></div>;
  if (!g.paid) return <div className="page center"><p className="lead">This gift hasn&apos;t been paid for yet.</p></div>;

  const waUrl = `https://wa.me/?text=${encodeURIComponent(`☕ I bought you a ${g.itemName} at Moss & Moon! Claim it here: ${typeof window !== "undefined" ? window.location.origin : ""}/d/${g.code}`)}`;

  return (
    <div className="page narrow">
      {sent && (
        <div className="card gift-sent">
          <strong>🎁 Paid! Now send it to {g.toName}</strong>
          <div className="row">
            <a className="btn btn-pink btn-sm" href={waUrl} target="_blank" rel="noreferrer">Send on WhatsApp</a>
            <button className="btn btn-ghost btn-sm" onClick={share}>🔗 Share or copy link</button>
          </div>
        </div>
      )}
      <div className="drink-gift card">
        {g.img && <div className="drink-gift-photo"><Image src={photo(g.img, 800)} alt={g.itemName} fill sizes="(max-width: 640px) 100vw, 640px" preload /></div>}
        <div className="drink-gift-body">
          <p className="eyebrow" style={{ margin: 0 }}>a coffee for {g.toName}</p>
          <h1 className="h2" style={{ margin: "0.3rem 0" }}><em>{g.fromName}</em> bought you a {g.itemName}</h1>
          {g.note && <p className="small muted">{g.note} · worth {rupees(g.amount)}</p>}
          {g.message && <blockquote className="gift-msg">“{g.message}”</blockquote>}

          {g.orderCode ? (
            <div className="reward-banner">✓ Claimed{g.redeemedAt ? ` on ${g.redeemedAt.slice(0, 10)}` : ""}. <Link href={`/order/${g.orderCode}`} className="link-btn">See the order</Link></div>
          ) : g.expired ? (
            <div className="reward-banner">This gift expired on {g.expires}. Show it at the counter and we&apos;ll sort something out ✿</div>
          ) : !claiming ? (
            <div className="row" style={{ alignItems: "center" }}>
              <button className="btn btn-pink" onClick={() => setClaiming(true)} disabled={!g.available}>{g.available ? "☕ Claim it now" : "Sold out today"}</button>
              <span className="small muted">or show this at the counter · valid until {g.expires}</span>
            </div>
          ) : (
            <form className="row" onSubmit={claim} style={{ alignItems: "end" }}>
              <label className="field" style={{ flex: 1, minWidth: 150 }}>Name for the cup<input className="input" required maxLength={40} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="field" style={{ flex: 1, minWidth: 150 }}>Phone (optional, for a stamp)<input className="input" inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
              <button className="btn btn-pink" disabled={busy}>{busy ? "Sending…" : table ? `Bring it to table ${table}` : "Make it for pickup"}</button>
            </form>
          )}
        </div>
        {!g.orderCode && !g.expired && (
          <div className="drink-gift-qr">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/drink-gifts/${g.code}/qr`} alt={`QR code for gift ${g.code}`} width={140} height={140} />
            <span className="code">{g.code}</span>
          </div>
        )}
      </div>
      <p className="center small muted" style={{ marginTop: "1.2rem" }}>Want to pass the kindness on? <Link href="/gift-a-drink" className="link-btn">Buy someone a coffee</Link></p>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="page center muted">Unwrapping…</div>}><DrinkGift /></Suspense>;
}
