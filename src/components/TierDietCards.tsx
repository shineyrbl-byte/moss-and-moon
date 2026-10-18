"use client";
import { useEffect, useState } from "react";
import { ALLERGENS } from "@/lib/nutrition";
import { TIERS } from "@/lib/tiers";
import { useStore } from "./Store";

type Tier = { id: string; name: string; icon: string; visits: number; perks: string[]; next: { name: string; icon: string; needed: number; min: number } | null };

/** Account page: loyalty tier + dietary profile */
export default function TierDietCards() {
  const { me, refreshMe, toast } = useStore();
  const [tier, setTier] = useState<Tier | null>(null);
  const [diet, setDiet] = useState({ vegan: false, gf: false, avoid: [] as string[] });
  useEffect(() => {
    fetch("/api/account").then((r) => r.json()).then((d) => d.tier && setTier(d.tier)).catch(() => {});
  }, []);
  useEffect(() => { if (me?.diet) setDiet(me.diet); }, [me?.diet]);

  async function save(next: typeof diet) {
    setDiet(next);
    const r = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ diet: next }) });
    if (!r.ok) return toast((await r.json()).error);
    refreshMe();
  }
  const pct = tier?.next ? Math.min(100, (tier.visits / tier.next.min) * 100) : 100;
  return (
    <div className="account-grid">
      {tier && (
        <div className="card account-card tier-card">
          <h3>{tier.icon} {tier.name} member</h3>
          <ul className="small" style={{ paddingLeft: "1.1rem" }}>{tier.perks.map((p) => <li key={p}>{p}</li>)}</ul>
          {tier.next ? (
            <>
              <div className="badge-meter" role="meter" aria-valuenow={tier.visits} aria-valuemin={0} aria-valuemax={tier.next.min} aria-label="Progress to the next tier" style={{ width: "100%", height: 8 }}><span style={{ width: `${pct}%` }} /></div>
              <p className="small muted">{tier.visits} visits this year · {tier.next.needed} more to {tier.next.icon} {tier.next.name}</p>
            </>
          ) : <p className="small muted">{tier.visits} visits this year. Thank you for being here so often ✿</p>}
          <p className="tiny muted">{TIERS.map((t) => `${t.icon} ${t.name} ${t.min}+`).join(" · ")} visits a year</p>
        </div>
      )}
      <div className="card account-card">
        <h3>🥗 Dietary profile</h3>
        <p className="small muted">We&apos;ll show what suits you first and warn you about anything that doesn&apos;t.</p>
        <div className="chips" style={{ justifyContent: "flex-start" }}>
          <button className={`chip ${diet.vegan ? "on" : ""}`} aria-pressed={diet.vegan} onClick={() => save({ ...diet, vegan: !diet.vegan })}>🌱 Vegan</button>
          <button className={`chip ${diet.gf ? "on" : ""}`} aria-pressed={diet.gf} onClick={() => save({ ...diet, gf: !diet.gf })}>🌾 Gluten-free</button>
        </div>
        <b className="small">I avoid…</b>
        <div className="chips" style={{ justifyContent: "flex-start" }}>
          {ALLERGENS.map((a) => {
            const on = diet.avoid.includes(a.id);
            return <button key={a.id} className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => save({ ...diet, avoid: on ? diet.avoid.filter((x) => x !== a.id) : [...diet.avoid, a.id] })}>{a.icon} {a.label}</button>;
          })}
        </div>
        <p className="tiny muted">For severe allergies, please always tell us when you order too.</p>
      </div>
    </div>
  );
}
