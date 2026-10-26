"use client";
import "./page.css";
import { useEffect, useState } from "react";
import { voterId } from "@/components/LabCard";
import { useStore } from "@/components/Store";

type Poll = { week: string; q: string; choices: string[]; mine: number | null; total: number; counts?: number[]; last: { q: string; winner: string; total: number } | null };

export default function PollPage() {
  const { toast } = useStore();
  const [p, setP] = useState<Poll | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch(`/api/poll?voter=${voterId()}`).then((r) => r.json()).then(setP).catch(() => {}); }, []);
  async function vote(i: number) {
    setBusy(true);
    const r = await fetch("/api/poll", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ choice: i, voter: voterId() }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return toast(d.error);
    setP(d);
  }
  if (!p) return <div className="page narrow"><p className="muted">Asking around…</p></div>;
  const max = Math.max(1, ...(p.counts ?? [1]));
  return (
    <div className="page" style={{ maxWidth: "36rem" }}>
      <p className="eyebrow">week of {new Date(`${p.week}T12:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}</p>
      <h1 className="h2">This week&apos;s <em>poll</em></h1>
      <section className="card poll-card" aria-live="polite">
        <h2 className="h3" style={{ marginTop: 0 }}>{p.q}</h2>
        {p.counts ? (
          <ul className="poll-results">
            {p.choices.map((c, i) => {
              const pct = p.total ? Math.round(((p.counts![i] ?? 0) / p.total) * 100) : 0;
              return (
                <li key={i} className={p.mine === i ? "mine" : ""}>
                  <span className="poll-label"><span>{c}{p.mine === i ? " ✓" : ""}</span><b>{pct}%</b></span>
                  <span className="poll-bar" aria-hidden="true"><span style={{ width: `${((p.counts![i] ?? 0) / max) * 100}%` }} /></span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="trivia-choices">{p.choices.map((c, i) => <button key={i} className="trivia-choice" disabled={busy} onClick={() => vote(i)}>{c}</button>)}</div>
        )}
        <p className="small muted" style={{ margin: "0.8rem 0 0" }}>{p.total} vote{p.total === 1 ? "" : "s"} so far · {p.counts ? "a new question every Monday" : "results show once you vote"}</p>
      </section>
      {p.last && <p className="small" style={{ marginTop: "1rem" }}>Last week: &ldquo;{p.last.q}&rdquo; · <b>{p.last.winner}</b> won ({p.last.total} votes)</p>}
    </div>
  );
}
