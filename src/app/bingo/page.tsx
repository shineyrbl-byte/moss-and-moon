"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { defaultOptions, rupees } from "@/lib/pricing";
import { itemName } from "@/lib/menu";

type Sq = { id: string; name: string; cat: string; stamped: boolean; date: string | null; orderable: boolean };
type B = { month: string; squares: Sq[]; lines: number[][]; stamped: number; claimed: boolean; reward: number; signedIn: boolean };
const ICON: Record<string, string> = { coffee: "☕", tea: "🍵", cold: "🧋", food: "🥪", bakes: "🥐" };

export default function Bingo() {
  const { find, lang, add, toast, setDrawerOpen } = useStore();
  const [b, setB] = useState<B | null>(null);
  const load = () => fetch("/api/account/bingo").then((r) => r.json()).then(setB).catch(() => {});
  useEffect(() => { load(); }, []);
  async function claim() {
    const r = await fetch("/api/account/bingo", { method: "POST" });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    toast(`🎉 Bingo! ${rupees(b!.reward)} added to your account.`);
    load();
  }
  const order = (id: string) => { const m = find(id); if (m) { add(m.id, defaultOptions(m), 1); toast(`${itemName(m, lang)} added ✿`); setDrawerOpen(true); } };
  if (!b) return <div className="page narrow"><p className="muted">Shuffling this month&apos;s card…</p></div>;
  const inLine = new Set(b.lines.flat());
  const monthName = new Date(`${b.month}-01T12:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  return (
    <div className="page" style={{ maxWidth: "44rem" }}>
      <p className="eyebrow">{monthName}</p>
      <h1 className="h2">Coffee <em>bingo</em></h1>
      <p className="lead">A new card every month, the same for everyone. Order a square&apos;s drink or bake to stamp it. Finish a row, column or diagonal and your next treat&apos;s on us ({rupees(b.reward)}).</p>
      {!b.signedIn && <p className="reward-banner small">Stamps come from orders made while signed in. <Link href="/account">Sign in</Link> to start stamping.</p>}
      {b.signedIn && (
        <div className="sum-row" style={{ alignItems: "center", margin: "0.6rem 0" }}>
          <b>{b.stamped} of {b.squares.length} stamped</b>
          <span className="small muted">{b.lines.length ? `${b.lines.length} line${b.lines.length > 1 ? "s" : ""} done` : "No lines yet"}</span>
        </div>
      )}
      {b.lines.length > 0 && (b.claimed
        ? <p className="reward-banner small">🏅 You&apos;ve had this month&apos;s treat. A new card arrives on the 1st.</p>
        : <div className="reward-banner" style={{ display: "flex", alignItems: "center", gap: "0.8rem", flexWrap: "wrap" }}><span style={{ flex: 1 }}>🎉 <b>Bingo!</b> You finished a line.</span><button className="btn btn-pink btn-sm" onClick={claim}>Claim {rupees(b.reward)} credit</button></div>)}
      <ol className="bingo-card" aria-label="Bingo card">
        {b.squares.map((s) => {
          const m = find(s.id);
          return (
            <li key={s.id} className={`bingo-sq ${s.stamped ? "on" : ""} ${inLine.has(b.squares.indexOf(s)) ? "line" : ""}`}>
              <span className="bingo-ico" aria-hidden>{s.stamped ? "✿" : ICON[s.cat] ?? "☕"}</span>
              <span className="bingo-name">{m ? itemName(m, lang) : s.name}</span>
              {s.stamped ? <span className="tiny muted">{s.date?.slice(8)}/{s.date?.slice(5, 7)}</span>
                : s.orderable && m ? <button className="link-btn tiny" onClick={() => order(s.id)} aria-label={`Add ${s.name}`}>＋ add</button>
                : <span className="tiny muted">not on today</span>}
              <span className="sr-only">{s.stamped ? "stamped" : "not stamped"}</span>
            </li>
          );
        })}
      </ol>
      <p className="small muted">Cancelled orders don&apos;t count. One treat a month, added as credit on your account. Also try the <Link href="/passport">origins passport</Link>.</p>
    </div>
  );
}
