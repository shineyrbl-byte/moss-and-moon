"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";

type R = { streak: number; ready: number; nextIn: number; signedIn: boolean; hasPhone: boolean; stamps?: number };
const PER = 7;

/** "Café rewards": a week of today's five earns a loyalty stamp */
export default function GameRewards() {
  const { toast } = useStore();
  const [r, setR] = useState<R | null>(null);
  useEffect(() => { fetch(`/api/game-rewards?voter=${voterId()}`).then((x) => x.json()).then(setR).catch(() => {}); }, []);
  if (!r) return null;
  async function claim() {
    const x = await fetch("/api/game-rewards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voter: voterId() }) });
    const d = await x.json();
    if (!x.ok) return toast(d.error);
    setR(d); toast(`A stamp's on your card 🎟️ You have ${d.stamps} now.`);
  }
  const into = r.streak % PER;
  return (
    <section className="card game-rewards" aria-label="Café rewards">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
        <div>
          <b>🎟️ Café rewards</b>
          <p className="small muted" style={{ margin: "0.15rem 0 0" }}>
            {r.ready ? `You've earned ${r.ready === 1 ? "a stamp" : `${r.ready} stamps`} for your loyalty card!` : `Finish today's five ${PER} days running for a stamp on your loyalty card. ${r.streak ? `${r.nextIn} to go.` : ""}`}
          </p>
        </div>
        {r.ready > 0 && (r.signedIn ? (r.hasPhone ? <button className="btn btn-pink btn-sm" onClick={claim}>Collect</button> : <Link className="btn btn-ghost btn-sm" href="/account">Add your phone</Link>) : <Link className="btn btn-pink btn-sm" href="/account">Sign in to collect</Link>)}
      </div>
      <div className="gr-dots" aria-label={`${into} of ${PER} days towards the next stamp`}>{[...Array(PER).keys()].map((k) => <i key={k} className={k < into || r.ready ? "on" : ""} />)}</div>
    </section>
  );
}
