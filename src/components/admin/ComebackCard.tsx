"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";
import { COMEBACK_MIN, monthLabel } from "@/lib/comeback";

type S = { month: string; next: string; candidates: { id: string; name: string; votes: number }[]; back: { name: string } | null; nextPick: string | null };

/** Menu tab: the "bring it back" vote, and next month's comeback (owners can choose by hand) */
export default function ComebackCard({ canEdit }: { canEdit: boolean }) {
  const { toast } = useStore();
  const [s, setS] = useState<S | null>(null);
  const load = () => fetch("/api/comeback?staff=1").then((r) => (r.ok ? r.json() : null)).then(setS).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!s) return null;
  async function pick(v: string) {
    const r = await fetch("/api/comeback", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month: s!.next, pick: v }) });
    if (!r.ok) return toast((await r.json()).error);
    toast("Saved ✓"); load();
  }
  const top = [...s.candidates].sort((a, b) => b.votes - a.votes).slice(0, 5);
  const nextName = s.nextPick ? s.candidates.find((c) => c.id === s.nextPick)?.name ?? s.nextPick : null;
  return (
    <section className="card" style={{ padding: "1rem 1.2rem", marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "1.15rem" }}>🗳 Bring it back</h3>
      <p className="small muted">{s.back ? <>Back this month: <b>{s.back.name}</b>. </> : "Nothing is back by vote this month. "}Guests vote at <a href="/bring-it-back" target="_blank" rel="noreferrer">/bring-it-back</a>; the leader with {COMEBACK_MIN}+ votes returns in {monthLabel(s.next)}.</p>
      {top.some((c) => c.votes) ? (
        <ul className="check-list">{top.filter((c) => c.votes).map((c) => <li key={c.id}><span style={{ flex: 1 }}>{c.name}</span><b>{c.votes}</b></li>)}</ul>
      ) : <p className="small muted">No votes yet this month.</p>}
      <p className="small" style={{ marginBottom: 0 }}>Coming back in {monthLabel(s.next)}: <b>{nextName ?? "the vote decides"}</b></p>
      {canEdit && (
        <label className="field small" style={{ marginTop: "0.5rem", maxWidth: "22rem" }}>Choose it yourself
          <select className="input" defaultValue="" onChange={(e) => e.target.value && pick(e.target.value)}>
            <option value="">—</option>
            <option value="auto">Let the vote decide</option>
            <option value="none">Nothing comes back</option>
            {s.candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}
    </section>
  );
}
