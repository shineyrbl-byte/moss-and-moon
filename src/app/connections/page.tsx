"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";

type Group = { level: number; name: string; words: string[]; found: boolean };
type State = { date: string; mistakesAllowed: number; mistakes: number; done: boolean; solved: boolean; groups: Group[]; tiles: string[]; grid?: string; away?: number; streak: number; best: number; played: number; solvedToday: number };

export default function Connections() {
  const { toast } = useStore();
  const [s, setS] = useState<State | null>(null);
  const [pick, setPick] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const apply = (d: State) => { setS(d); setOrder((o) => (o.length ? o.filter((w) => d.tiles.includes(w)) : d.tiles)); };
  useEffect(() => { fetch(`/api/connections?voter=${voterId()}`).then((r) => r.json()).then(apply).catch(() => {}); }, []);
  const toggle = (w: string) => setPick((p) => (p.includes(w) ? p.filter((x) => x !== w) : p.length < 4 ? [...p, w] : p));
  function mix() {
    const a = [...order];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    setOrder(a);
  }
  async function submit() {
    setBusy(true);
    const r = await fetch("/api/connections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ words: pick, voter: voterId() }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return toast(d.error ?? "That didn't work. Try again?");
    const before = s?.groups.length ?? 0;
    apply(d);
    if (d.groups.length > before && !d.done) { setPick([]); return; }
    if (d.done) { setPick([]); return; }
    setShake(true); setTimeout(() => setShake(false), 450);
    if (d.away === 1) toast("So close: one away!");
  }
  async function share() {
    const text = `Moss & Moon connections ${s!.date}\n${s!.grid}`;
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast("Copied ✓"); } } catch {}
  }
  if (!s) return <div className="page"><p className="muted">Setting out the words…</p></div>;
  const left = s.mistakesAllowed - s.mistakes;
  return (
    <div className="page" style={{ maxWidth: "36rem" }}>
      <p className="eyebrow">a daily puzzle</p>
      <h1 className="h2">Café <em>connections</em></h1>
      <p className="small muted">Find four groups of four. Tap four words that belong together, then check. Careful: some words look like they fit more than one group.</p>
      <div className="conn-groups">
        {s.groups.map((g) => (
          <div key={g.level} className={`conn-group lvl-${g.level} ${g.found ? "" : "missed"}`}>
            <b>{g.name}</b><span>{g.words.join(", ")}</span>
          </div>
        ))}
      </div>
      {!s.done && (
        <>
          <div className={`conn-grid ${shake ? "shake" : ""}`} role="group" aria-label="Words left">
            {order.map((w) => <button key={w} className={`conn-tile ${pick.includes(w) ? "on" : ""} ${w.length > 8 ? "long" : ""}`} aria-pressed={pick.includes(w)} onClick={() => toggle(w)}>{w}</button>)}
          </div>
          <p className="small center" aria-live="polite">Mistakes left: <span className="conn-dots" aria-label={`${left} of ${s.mistakesAllowed}`}>{[...Array(s.mistakesAllowed)].map((_, i) => <span key={i} className={i < left ? "on" : ""} />)}</span></p>
          <div className="row" style={{ justifyContent: "center", gap: "0.4rem", flexWrap: "wrap" }}>
            <button className="btn btn-ghost btn-sm" onClick={mix}>Shuffle</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setPick([])} disabled={!pick.length}>Deselect all</button>
            <button className="btn btn-pink btn-sm" onClick={submit} disabled={busy || pick.length !== 4}>Check</button>
          </div>
        </>
      )}
      {s.done && (
        <section className="card center" style={{ padding: "1rem", marginTop: "1rem" }} aria-live="polite">
          <b>{s.solved ? (s.mistakes === 0 ? "Perfect! Not a single slip 🎉" : "Got them all 🎉") : "Out of guesses. Here's how they went together."}</b>
          <pre className="conn-share">{s.grid}</pre>
          <p className="small muted" style={{ margin: "0.3rem 0" }}>🔥 {s.streak} day streak · best {s.best} · {s.solvedToday} of {s.played} solved it today</p>
          <button className="btn btn-pink btn-sm" onClick={share}>Share</button>
          <p className="tiny muted">A new puzzle tomorrow.</p>
        </section>
      )}
    </div>
  );
}
