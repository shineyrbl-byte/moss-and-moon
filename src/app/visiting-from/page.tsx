"use client";
import "./page.css";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { COUNTRIES, STATES } from "@/lib/places";

type S = { month: string; top: { place: string; kind: string; n: number }[]; people: number; states: number; countries: number; ever: { places: number; people: number }; mine: string | null };

export default function VisitingFrom() {
  const { toast } = useStore();
  const [s, setS] = useState<S | null>(null);
  const [pick, setPick] = useState("");
  useEffect(() => { fetch(`/api/visiting-from?voter=${voterId()}`).then((r) => r.json()).then((d) => { setS(d); if (d.mine) setPick(d.mine); }).catch(() => {}); }, []);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/visiting-from", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ place: pick, voter: voterId() }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setS(d); toast(pick === "Goa" ? "A local! 🌴 Welcome back." : `Welcome from ${pick} 👋`);
  }
  if (!s) return <div className="page"><p className="muted">Unfolding the map…</p></div>;
  const max = Math.max(1, ...s.top.map((t) => t.n));
  const monthName = new Date(`${s.month}-15T12:00`).toLocaleDateString("en-IN", { month: "long" });
  return (
    <div className="page" style={{ maxWidth: "40rem" }}>
      <p className="eyebrow">say hello</p>
      <h1 className="h2">Where are you <em>visiting from?</em></h1>
      <p className="lead">Tap where you&apos;re from and see who else has stopped by this month. No names, just places.</p>
      <form className="card kind-form" onSubmit={send}>
        <label className="field">I&apos;m from
          <select className="input" required value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Pick a state or country…</option>
            <optgroup label="India">{STATES.map((p) => <option key={p} value={p}>{p}</option>)}</optgroup>
            <optgroup label="Outside India">{COUNTRIES.map((p) => <option key={p} value={p}>{p}</option>)}</optgroup>
          </select>
        </label>
        <span className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <span className="tiny muted">{s.mine ? `You said ${s.mine} today. You can change it.` : "Once a day, anonymous."}</span>
          <button className="btn btn-pink btn-sm" disabled={!pick || pick === s.mine}>{s.mine ? "Change" : "Add me"}</button>
        </span>
      </form>
      <section className="origin-sum" aria-label={`${monthName} so far`}>
        <div><b>{s.people}</b><span className="tiny muted">visitors said hi</span></div>
        <div><b>{s.states}</b><span className="tiny muted">states</span></div>
        <div><b>{s.countries}</b><span className="tiny muted">countries</span></div>
      </section>
      <h2 className="h3">Top 10 in {monthName}</h2>
      {s.top.length ? (
        <ol className="origin-list">
          {s.top.map((t) => (
            <li key={t.place} className={t.place === s.mine ? "mine" : ""}>
              <span>{t.kind === "country" ? "🌍" : "📍"} {t.place}</span>
              <span className="origin-bar" aria-hidden="true"><span style={{ width: `${(t.n / max) * 100}%` }} /></span>
              <b>{t.n}</b>
            </li>
          ))}
        </ol>
      ) : <p className="small muted">Nobody yet this month. Be the first!</p>}
      {s.ever.places > 0 && <p className="tiny muted" style={{ marginTop: "1rem" }}>Since we started asking: {s.ever.people} hellos from {s.ever.places} places.</p>}
    </div>
  );
}
