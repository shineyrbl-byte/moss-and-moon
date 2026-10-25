"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { defaultOptions, rupees } from "@/lib/pricing";
import { itemDesc, itemName, photo } from "@/lib/menu";

type P = { id: number; url: string; caption: string; name: string };

export default function Pups() {
  const { menu, lang, add, toast, setDrawerOpen } = useStore();
  const treats = menu.filter((m) => m.pup);
  const [pups, setPups] = useState<P[] | null>(null);
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { fetch("/api/photos?kind=pup").then((r) => r.json()).then((d) => setPups(d.photos ?? [])).catch(() => setPups([])); }, []);

  async function share(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr("");
    const f = new FormData(e.currentTarget);
    f.set("kind", "pup");
    const r = await fetch("/api/photos", { method: "POST", body: f });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(d.error ?? "That didn't upload. Try again?");
    setSharing(false);
    toast("Woof, thank you! 🐾 They'll be on the wall once we've had a look.");
  }
  const order = (id: string) => { const m = treats.find((x) => x.id === id); if (m) { add(m.id, defaultOptions(m), 1); toast(`${itemName(m, lang)} added 🐾`); setDrawerOpen(true); } };

  return (
    <div className="page" style={{ maxWidth: "62rem" }}>
      <p className="eyebrow">four legs welcome</p>
      <h1 className="h2">Pups at <em>Moss &amp; Moon</em></h1>
      <p className="lead">Well-behaved dogs are welcome on the terrace and by the window. There&apos;s always a water bowl, and a little menu just for them.</p>
      <p className="small"><a href="/adopt">🐾 Looking for a friend of your own? Meet the shelter pets →</a></p>
      <ul className="pup-rules small">
        <li>🐾 Tick <b>&ldquo;Bringing a dog&rdquo;</b> when you <Link href="/#visit">book a table</Link> and we&apos;ll seat you somewhere with room to lie down.</li>
        <li>💧 Water bowls by the door. Just ask for a refill.</li>
        <li>🦮 Leads on inside, please. The kitchen and counter are people-only.</li>
      </ul>

      <h2 className="h3" style={{ marginTop: "1.6rem" }}>The pup menu</h2>
      <p className="small muted">Baked here for dogs: no salt, sugar, onion, chocolate or xylitol. Ask us if your dog has allergies.</p>
      <div className="pup-menu">
        {treats.map((m) => (
          <article key={m.id} className="card pup-treat">
            <div className="pup-photo"><Image src={photo(m.img, 500)} alt="" fill sizes="(max-width: 600px) 45vw, 220px" style={{ objectFit: "cover" }} /></div>
            <div style={{ padding: "0.8rem" }}>
              <b>{itemName(m, lang)}</b>
              <p className="small muted" style={{ margin: "0.3rem 0 0.6rem" }}>{itemDesc(m, lang)}</p>
              <div className="sum-row" style={{ alignItems: "center" }}>
                <span>{rupees(m.price)}</span>
                <button className="btn btn-pink btn-sm" disabled={m.soldOut} onClick={() => order(m.id)}>{m.soldOut ? "Sold out" : "Add"}</button>
              </div>
            </div>
          </article>
        ))}
        {!treats.length && <p className="muted">The pup menu is having a nap. Ask at the counter ✿</p>}
      </div>

      <h2 className="h3" style={{ marginTop: "2rem" }}>Our regulars</h2>
      <div className="pup-wall">
        {pups?.map((p) => (
          <figure key={p.id} className="pup-pic">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={`${p.name}, a regular pup`} loading="lazy" />
            <figcaption><b>{p.name}</b>{p.caption ? ` · ${p.caption}` : ""}</figcaption>
          </figure>
        ))}
        {pups?.length === 0 && <p className="muted">No regulars on the wall yet. Yours could be first 🐶</p>}
      </div>
      <div className="center" style={{ marginTop: "1.2rem" }}>
        {!sharing ? <button className="btn btn-ghost btn-sm" onClick={() => setSharing(true)}>🐾 Add your dog to the wall</button> : (
          <form className="card share-photo" onSubmit={share}>
            <label className="field">A photo of your dog<input className="input" type="file" name="file" accept="image/jpeg,image/png,image/webp" required /></label>
            <div className="row">
              <label className="field">Their name<input className="input" name="name" maxLength={30} required placeholder="Biscuit" /></label>
              <label className="field">About them <span className="muted small">· optional</span><input className="input" name="caption" maxLength={120} placeholder="Indie, 3, loves the pupsicle" /></label>
            </div>
            <p className="tiny muted">We&apos;ll have a look before it goes up. Just the dog, please: no people&apos;s faces.</p>
            {err && <p className="error small">{err}</p>}
            <span className="row" style={{ gap: "0.5rem", justifyContent: "center" }}>
              <button className="btn btn-pink btn-sm" disabled={busy}>{busy ? "Uploading…" : "Send it"}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSharing(false)}>Cancel</button>
            </span>
          </form>
        )}
      </div>
    </div>
  );
}
