"use client";
import "./page.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { isDrink, rupees } from "@/lib/pricing";
import { defaultOptions } from "@/lib/pricing";
import { FLAVOURS, MAX_NOTES, flavourLabel } from "@/lib/flavours";

type Entry = { id: number; item_id: string | null; name: string; place: string | null; rating: number; note: string | null; caffeine: number | null; flavours: string[]; created_at: string };
type Profile = { count: number; avg: number | null; places: number; flavours: string[]; best: { name: string; place: string | null; rating: number }[]; words: string | null; energy: number | null; sweet: number | null; iced: number | null; tryNext: { id: string; name: string; desc: string; price: number } | null };
type Data = { entries: Entry[]; profile: Profile; toRate: { orderCode: string; itemId: string; name: string; date: string }[]; caffeine: { total: number; limit: number; drinks: { name: string; caffeine: number }[]; nudge: string | null } };

function Stars({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="star-pick" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button type="button" key={n} role="radio" aria-checked={value === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} className={n <= value ? "lit" : ""} onClick={() => onChange(n)}>★</button>
      ))}
    </div>
  );
}

/** A little bar for one side of your taste */
function Lean({ left, right, pct }: { left: string; right: string; pct: number }) {
  return (
    <div className="diary-lean">
      <span className="small muted">{left}</span>
      <div className="meter" aria-hidden style={{ maxWidth: "none", flex: 1 }}><span style={{ width: `${Math.max(4, pct)}%` }} /></div>
      <span className="small muted">{right}</span>
    </div>
  );
}

export default function Diary() {
  const { menu, add, toast, setDrawerOpen } = useStore();
  const [d, setD] = useState<Data | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [form, setForm] = useState({ where: "here" as "here" | "elsewhere", itemId: "", name: "", place: "", rating: 0, note: "", caffeine: "", flavours: [] as string[] });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => fetch("/api/account/diary").then(async (r) => {
    if (r.status === 401) return setSignedIn(false);
    setSignedIn(true);
    setD(await r.json());
  }).catch(() => {});
  useEffect(() => { load(); }, []);

  async function post(body: Record<string, unknown>) {
    setBusy(true); setError("");
    const r = await fetch("/api/account/diary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(j.error ?? "That didn't save."); return false; }
    load();
    return true;
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.rating) return setError("Give it some stars first.");
    const ok = await post(form.where === "here" ? { itemId: form.itemId, rating: form.rating, note: form.note, flavours: form.flavours } : { name: form.name, place: form.place, rating: form.rating, note: form.note, flavours: form.flavours, caffeine: form.caffeine === "" ? undefined : Number(form.caffeine) });
    if (ok) { setForm({ ...form, itemId: "", name: "", place: "", rating: 0, note: "", caffeine: "", flavours: [] }); toast("Added to your diary ✿"); }
  }
  async function remove(id: number) {
    await fetch(`/api/account/diary?id=${id}`, { method: "DELETE" });
    load();
  }

  if (signedIn === false)
    return (
      <div className="page narrow center">
        <span style={{ fontSize: "3rem" }}>📔</span>
        <h1 className="h2">Your <em>coffee diary</em></h1>
        <p className="lead">Log every coffee you try, here or anywhere, rate it, and we&apos;ll work out your taste and what to try next.</p>
        <Link href="/account" className="btn btn-pink">Sign in to start</Link>
      </div>
    );
  if (!d) return <div className="page narrow"><p className="muted">Opening your diary…</p></div>;
  const p = d.profile;
  const drinks = menu.filter((m) => isDrink(m.cat) && !m.groups?.length).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="page narrow">
      <p className="eyebrow">just for you</p>
      <h1 className="h2">Your <em>coffee diary</em></h1>
      <p className="small"><Link href="/passport">🛂 Your origins passport</Link> · <Link href="/lab">🧪 Drink lab</Link></p>

      <section className="card diary-profile">
        <h3 style={{ fontSize: "1.2rem" }}>☕ Your taste</h3>
        {p.words ? (
          <>
            <p className="lead" style={{ margin: "0.2rem 0 0.6rem" }}>You like it <b>{p.words}</b>.</p>
            <Lean left="Gentle" right="Strong" pct={p.energy!} />
            <Lean left="Not sweet" right="Sweet" pct={p.sweet!} />
            <Lean left="Hot" right="Iced" pct={p.iced!} />
          </>
        ) : <p className="muted small">Rate two or more of our drinks and your taste profile appears here.</p>}
        {p.flavours.length > 0 && <p className="small" style={{ marginTop: "0.6rem" }}>💛 Flavours you love: <b>{p.flavours.map(flavourLabel).join(" · ")}</b></p>}
        <p className="small muted" style={{ marginTop: "0.6rem" }}>{p.count} entr{p.count === 1 ? "y" : "ies"}{p.avg !== null ? ` · average ${p.avg}★` : ""}{p.places ? ` · ${p.places} place${p.places === 1 ? "" : "s"}` : ""}</p>
        {p.best.length > 0 && <p className="small">🏆 Best so far: {p.best.map((b) => `${b.name}${b.place && b.place !== "Moss & Moon" ? ` (${b.place})` : ""} ${"★".repeat(b.rating)}`).join(" · ")}</p>}
        {p.tryNext && (
          <div className="reward-banner" style={{ display: "flex", alignItems: "center", gap: "0.8rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
            <span style={{ flex: 1 }}>✨ <b>Try next: {p.tryNext.name}</b><br /><small className="muted">{p.tryNext.desc}</small></span>
            <button className="btn btn-pink btn-sm" onClick={() => { const m = menu.find((x) => x.id === p.tryNext!.id); if (m) { add(m.id, defaultOptions(m), 1); toast(`${m.name} added ✿`); setDrawerOpen(true); } }}>Add · {rupees(p.tryNext.price)}</button>
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: "1rem" }} aria-label="Caffeine today">
        <div className="sum-row" style={{ alignItems: "baseline" }}>
          <h3 style={{ fontSize: "1.1rem" }}>⚡ Caffeine today</h3>
          <span><b>{d.caffeine.total} mg</b> <span className="muted small">of {d.caffeine.limit}</span></span>
        </div>
        <div className={`meter ${d.caffeine.total > d.caffeine.limit ? "over" : ""}`} role="meter" aria-valuenow={d.caffeine.total} aria-valuemin={0} aria-valuemax={d.caffeine.limit} aria-label="Caffeine today" style={{ maxWidth: "none" }}><span style={{ width: `${Math.min(100, (d.caffeine.total / d.caffeine.limit) * 100)}%` }} /></div>
        {d.caffeine.drinks.length > 0 ? <p className="small muted" style={{ margin: "0.4rem 0 0" }}>{d.caffeine.drinks.map((x) => `${x.name} ${x.caffeine} mg`).join(" · ")}</p> : <p className="small muted" style={{ margin: "0.4rem 0 0" }}>Nothing logged today. Add your coffees below to keep count.</p>}
        {d.caffeine.nudge && <p className="diet-warn small" style={{ marginTop: "0.5rem" }}>🌙 {d.caffeine.nudge}</p>}
      </section>

      {d.toRate.length > 0 && (
        <section className="card" style={{ marginTop: "1rem" }}>
          <h3 style={{ fontSize: "1.1rem" }}>⭐ Rate your recent drinks</h3>
          <ul className="check-list">
            {d.toRate.map((r) => (
              <li key={r.orderCode + r.itemId}>
                <span style={{ flex: 1 }}><b>{r.name}</b><br /><small className="muted">{r.date}</small></span>
                <Stars value={0} label={`Rate ${r.name}`} onChange={(n) => post({ itemId: r.itemId, orderCode: r.orderCode, rating: n }).then((ok) => ok && toast("Rated ✿"))} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <form className="card booking" onSubmit={save} style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.8rem" }}>
        <h3 style={{ fontSize: "1.1rem" }}>✍️ Add an entry</h3>
        <div className="chips" role="radiogroup" aria-label="Where" style={{ justifyContent: "flex-start" }}>
          <button type="button" role="radio" aria-checked={form.where === "here"} className={`chip ${form.where === "here" ? "on" : ""}`} onClick={() => setForm({ ...form, where: "here" })}>At Moss & Moon</button>
          <button type="button" role="radio" aria-checked={form.where === "elsewhere"} className={`chip ${form.where === "elsewhere" ? "on" : ""}`} onClick={() => setForm({ ...form, where: "elsewhere" })}>Somewhere else</button>
        </div>
        {form.where === "here" ? (
          <label className="field">Which drink?
            <select className="input" required value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })}>
              <option value="">Choose…</option>
              {drinks.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        ) : (
          <div className="row">
            <label className="field">What was it?<input className="input" required maxLength={60} placeholder="e.g. Flat white" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="field">Where? <span className="muted small">· optional</span><input className="input" maxLength={60} placeholder="e.g. a café in Bengaluru" value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} /></label>
            <label className="field">Caffeine (mg) <span className="muted small">· optional, we&apos;ll guess</span><input className="input" inputMode="numeric" maxLength={4} value={form.caffeine} onChange={(e) => setForm({ ...form, caffeine: e.target.value.replace(/\D/g, "") })} /></label>
          </div>
        )}
        <Stars value={form.rating} label="Your rating" onChange={(n) => setForm({ ...form, rating: n })} />
        <div>
          <span className="small muted">Tasting notes <span className="tiny">· up to {MAX_NOTES}</span></span>
          <div className="chips" role="group" aria-label="Tasting notes" style={{ justifyContent: "flex-start", marginTop: "0.3rem" }}>
            {FLAVOURS.map((fl) => {
              const on = form.flavours.includes(fl.id);
              return <button key={fl.id} type="button" aria-pressed={on} disabled={!on && form.flavours.length >= MAX_NOTES} className={`chip ${on ? "on" : ""}`} onClick={() => setForm({ ...form, flavours: on ? form.flavours.filter((x) => x !== fl.id) : [...form.flavours, fl.id] })}>{fl.icon} {fl.label}</button>;
            })}
          </div>
        </div>
        <label className="field">Notes <span className="muted small">· optional</span><textarea className="input" rows={2} maxLength={280} placeholder="Nutty, a bit too hot, perfect with the croissant…" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
        {error && <p className="error small">{error}</p>}
        <button className="btn btn-pink" disabled={busy}>{busy ? "Saving…" : "Add to my diary"}</button>
      </form>

      <section style={{ marginTop: "1.2rem" }}>
        <h3 style={{ fontSize: "1.1rem" }}>📔 Entries</h3>
        {!d.entries.length && <p className="muted small">Nothing yet. Your first coffee goes here ☕</p>}
        <ul className="diary-list">
          {d.entries.map((e) => (
            <li key={e.id} className="card">
              <div className="sum-row" style={{ alignItems: "baseline" }}>
                <span><b>{e.name}</b>{e.place && <span className="muted small"> · {e.place}</span>}{e.caffeine ? <span className="muted small"> · {e.caffeine} mg</span> : null}</span>
                <span className="stars" aria-label={`${e.rating} stars`}>{"★".repeat(e.rating)}{"☆".repeat(5 - e.rating)}</span>
              </div>
              {e.flavours.length > 0 && <p className="tiny muted" style={{ margin: "0.25rem 0" }}>{e.flavours.map(flavourLabel).join(" · ")}</p>}
              {e.note && <p className="small" style={{ margin: "0.3rem 0" }}>{e.note}</p>}
              <div className="sum-row"><small className="muted">{e.created_at.slice(0, 10)}</small><button className="link-btn tiny" onClick={() => remove(e.id)}>Delete</button></div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
