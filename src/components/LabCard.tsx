"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useStore } from "./Store";
import { photo } from "@/lib/menu";
import { rupees, type Options } from "@/lib/pricing";

export type LabCreation = { code: string; name: string; creator: string; votes: number; baseId: string; baseName: string; img: string; opts: Options; describe: string; price: number; available: boolean };

/** A visitor id kept in this browser, so each person votes once */
export function voterId() {
  try {
    let v = localStorage.getItem("mm-voter");
    if (!v) { v = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join(""); localStorage.setItem("mm-voter", v); }
    return v;
  } catch { return ""; }
}

/** One creation: photo of its base, what's in it, vote and order buttons */
export default function LabCard({ c, big = false }: { c: LabCreation; big?: boolean }) {
  const { add, toast, setDrawerOpen } = useStore();
  const [votes, setVotes] = useState(c.votes);
  const [voted, setVoted] = useState(false);
  async function vote() {
    const r = await fetch(`/api/lab/${c.code}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voter: voterId() }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return toast(d.error ?? "Couldn't count that vote.");
    setVotes(d.votes); setVoted(true);
    if (!d.counted) toast("You've already loved this one ♥");
  }
  function order() {
    add(c.baseId, { ...c.opts, note: `🧪 ${c.name}` }, 1);
    toast(`${c.name} added ✿`);
    setDrawerOpen(true);
  }
  return (
    <article className={`card lab-card ${big ? "big" : ""}`}>
      <div className="lab-ph"><Image src={photo(c.img, big ? 700 : 400)} alt="" fill sizes={big ? "(max-width: 700px) 100vw, 40rem" : "260px"} /></div>
      <div className="lab-body">
        {big ? <h2 className="h3">{c.name}</h2> : <Link href={`/lab/${c.code}`}><b>{c.name}</b></Link>}
        <span className="small muted">by {c.creator} · a {c.baseName}</span>
        <span className="small">{c.describe || "As it comes"}</span>
        <div className="row" style={{ gap: "0.4rem", alignItems: "center", marginTop: "auto", flexWrap: "wrap" }}>
          <button className={`chip ${voted ? "on" : ""}`} aria-pressed={voted} onClick={vote} aria-label={`Love ${c.name}, ${votes} votes`}>♥ {votes}</button>
          <button className="btn btn-pink btn-sm" disabled={!c.available} onClick={order}>{c.available ? `Order · ${rupees(c.price)}` : "Not available now"}</button>
        </div>
      </div>
    </article>
  );
}
