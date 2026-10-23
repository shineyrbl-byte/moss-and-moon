"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { foundMoons } from "@/components/HiddenMoon";
import { MOONS, type MoonId } from "@/lib/secret";
import { defaultOptions, rupees } from "@/lib/pricing";
import { itemDesc, itemName, photo } from "@/lib/menu";

export default function Secret() {
  const { secret, lang, add, toast, setDrawerOpen, setCustomizing } = useStore();
  const [found, setFound] = useState<MoonId[] | null>(null);
  useEffect(() => setFound(foundMoons()), [secret]);
  if (!found) return <div className="page narrow" />;
  const open = found.length === MOONS.length;
  return (
    <div className="page" style={{ maxWidth: "46rem" }}>
      <p className="eyebrow">shh…</p>
      <h1 className="h2">The <em>secret</em> menu</h1>
      {!open ? (
        <>
          <p className="lead">Five small moons (☾) are hidden around this site. Tap each one you find. Find all five and two off-menu drinks open up here.</p>
          <div className="moon-hunt" aria-label={`${found.length} of ${MOONS.length} found`}>
            {MOONS.map((m) => <span key={m.id} className={found.includes(m.id) ? "on" : ""}>{found.includes(m.id) ? "🌕" : "🌑"}</span>)}
          </div>
          <p className="center"><b>{found.length} of {MOONS.length}</b> found</p>
          <h2 className="h3">Hints</h2>
          <ul className="moon-hints">
            {MOONS.map((m) => <li key={m.id} className={found.includes(m.id) ? "done" : ""}>{found.includes(m.id) ? "✓ " : "☾ "}{m.hint}</li>)}
          </ul>
          <p className="small muted">Moons are remembered on this device.</p>
        </>
      ) : (
        <>
          <p className="lead">You found every moon 🌕 These aren&apos;t on the menu board. Order here, or just ask for them by name at the counter.</p>
          <div className="secret-grid">
            {secret.map((m) => (
              <article key={m.id} className="card secret-item">
                <div className="secret-photo"><Image src={photo(m.img, 600)} alt="" fill sizes="(max-width: 600px) 90vw, 340px" style={{ objectFit: "cover" }} /></div>
                <div style={{ padding: "0.9rem" }}>
                  <h2 className="h3" style={{ margin: 0 }}>{itemName(m, lang)}</h2>
                  <p className="small muted" style={{ margin: "0.35rem 0 0.7rem" }}>{itemDesc(m, lang)}</p>
                  <div className="sum-row" style={{ alignItems: "center" }}>
                    <span>{rupees(m.price)}</span>
                    <span className="row" style={{ gap: "0.4rem" }}>
                      {!m.noMilk && <button className="btn btn-ghost btn-sm" disabled={m.soldOut} onClick={() => setCustomizing(m)}>Customise</button>}
                      <button className="btn btn-pink btn-sm" disabled={m.soldOut} onClick={() => { add(m.id, defaultOptions(m), 1); toast(`${itemName(m, lang)} added 🤫`); setDrawerOpen(true); }}>{m.soldOut ? "Sold out" : "Add"}</button>
                    </span>
                  </div>
                </div>
              </article>
            ))}
            {!secret.length && <p className="muted">Opening the secret menu…</p>}
          </div>
        </>
      )}
    </div>
  );
}
