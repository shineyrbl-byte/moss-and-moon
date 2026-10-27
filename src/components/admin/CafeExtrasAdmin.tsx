"use client";
// Owner cards for the café extras: recipe of the week, coming soon, Goa events and board-game night
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";

const box = { padding: "1rem 1.1rem", marginBottom: "1rem" } as const;
async function send(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  return r.ok ? d : { error: d.error ?? "That didn't save." };
}

/** Journal tab: pick a make-at-home recipe to feature, with a video link if you have one */
export function RecipeWeekCard() {
  const { toast } = useStore();
  const [d, setD] = useState<{ week: { id: string; video: string; note: string } | null; recipes: { id: string; title: string }[] } | null>(null);
  const [f, setF] = useState({ id: "", video: "", note: "" });
  useEffect(() => { fetch("/api/admin/recipe-week").then((r) => (r.ok ? r.json() : null)).then((x) => { if (x) { setD(x); if (x.week) setF(x.week); else setF((v) => ({ ...v, id: x.recipes[0]?.id ?? "" })); } }).catch(() => {}); }, []);
  if (!d) return null;
  async function save(clear = false) {
    const r = await send("/api/admin/recipe-week", "POST", clear ? { clear: true } : f);
    if (r.error) return toast(r.error);
    setD({ ...d!, week: r.week }); toast(clear ? "Recipe of the week taken down" : "Recipe of the week is up ⭐");
  }
  return (
    <section className="card" style={box}>
      <h2 className="h3" style={{ marginTop: 0 }}>⭐ Recipe of the week</h2>
      <p className="small muted">Shown at the top of <a href="/recipes" target="_blank" rel="noreferrer">Make it at home</a>. Add a video link if you&apos;ve filmed one (YouTube, Instagram or anywhere with an https link).</p>
      <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem", alignItems: "end" }}>
        <label className="field small" style={{ marginBottom: 0 }}>Recipe<select className="input" value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })}>{d.recipes.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
        <label className="field small" style={{ marginBottom: 0, minWidth: "14rem" }}>Video link <span className="muted">· optional</span><input className="input" type="url" maxLength={300} value={f.video} onChange={(e) => setF({ ...f, video: e.target.value })} placeholder="https://…" /></label>
        <label className="field small" style={{ marginBottom: 0, minWidth: "14rem" }}>A note <span className="muted">· optional</span><input className="input" maxLength={200} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Perfect for the first rainy week" /></label>
        <button className="btn btn-pink btn-sm" onClick={() => save()}>Save</button>
        {d.week && <button className="btn btn-ghost btn-sm" onClick={() => save(true)}>Take it down</button>}
      </div>
    </section>
  );
}

/** Notices tab: a countdown on the home page to something you're planning */
export function ComingSoonCard() {
  const { toast } = useStore();
  const [cur, setCur] = useState<{ title: string; date: string; blurb: string; days: number } | null>(null);
  const [f, setF] = useState({ title: "", date: "", blurb: "" });
  useEffect(() => { fetch("/api/coming-soon").then((r) => r.json()).then((x) => { setCur(x.soon); if (x.soon) setF(x.soon); }).catch(() => {}); }, []);
  async function save(clear = false) {
    const r = await send("/api/coming-soon", "POST", clear ? { clear: true } : f);
    if (r.error) return toast(r.error);
    setCur(r.soon); toast(clear ? "Countdown taken down" : "Countdown is on the home page ⏳");
  }
  return (
    <section className="card" style={box}>
      <h2 className="h3" style={{ marginTop: 0 }}>⏳ Coming soon</h2>
      <p className="small muted">A countdown on the home page to a new dish, an event or a new branch. It disappears by itself once the day has passed.{cur ? ` Showing now: ${cur.title}, ${cur.days} day${cur.days === 1 ? "" : "s"} to go.` : ""}</p>
      <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem", alignItems: "end" }}>
        <label className="field small" style={{ marginBottom: 0 }}>What&apos;s coming<input className="input" maxLength={60} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Our winter menu" /></label>
        <label className="field small" style={{ marginBottom: 0 }}>On<input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        <label className="field small" style={{ marginBottom: 0, minWidth: "14rem" }}>A line about it <span className="muted">· optional</span><input className="input" maxLength={160} value={f.blurb} onChange={(e) => setF({ ...f, blurb: e.target.value })} /></label>
        <button className="btn btn-pink btn-sm" onClick={() => save()}>Save</button>
        {cur && <button className="btn btn-ghost btn-sm" onClick={() => save(true)}>Take it down</button>}
      </div>
    </section>
  );
}

type GE = { id: number; title: string; date: string; end_date: string; place: string; link: string; note: string };
/** Notices tab: events around Goa for the "Around the corner" page */
export function GoaEventsCard() {
  const { toast } = useStore();
  const [list, setList] = useState<GE[]>([]);
  const [f, setF] = useState({ title: "", date: "", end_date: "", place: "", link: "", note: "" });
  useEffect(() => { fetch("/api/goa-events?all=1").then((r) => (r.ok ? r.json() : null)).then((x) => x && setList(x.events)).catch(() => {}); }, []);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const r = await send("/api/goa-events", "POST", f);
    if (r.error) return toast(r.error);
    setList(r.events); setF({ title: "", date: "", end_date: "", place: "", link: "", note: "" }); toast("Added to Around the corner 📅");
  }
  async function remove(id: number) { const r = await send(`/api/goa-events?id=${id}`, "DELETE"); if (!r.error) setList(r.events); }
  return (
    <section className="card" style={box}>
      <h2 className="h3" style={{ marginTop: 0 }}>📅 What&apos;s on around Goa</h2>
      <p className="small muted">Festivals, markets and gigs near the café, shown on <a href="/nearby" target="_blank" rel="noreferrer">Around the corner</a> until they&apos;ve finished. Check the dates with the organisers first.</p>
      <form onSubmit={add} className="row" style={{ flexWrap: "wrap", gap: "0.5rem", alignItems: "end" }}>
        <label className="field small" style={{ marginBottom: 0 }}>Event<input className="input" required maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className="field small" style={{ marginBottom: 0 }}>From<input className="input" type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        <label className="field small" style={{ marginBottom: 0 }}>To <span className="muted">· optional</span><input className="input" type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></label>
        <label className="field small" style={{ marginBottom: 0 }}>Where<input className="input" maxLength={60} value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })} /></label>
        <label className="field small" style={{ marginBottom: 0 }}>Link <span className="muted">· optional</span><input className="input" type="url" maxLength={300} value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="https://…" /></label>
        <label className="field small" style={{ marginBottom: 0, minWidth: "14rem" }}>Note <span className="muted">· optional</span><input className="input" maxLength={160} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
        <button className="btn btn-pink btn-sm">Add</button>
      </form>
      {list.length > 0 && <ul className="small" style={{ marginTop: "0.6rem" }}>{list.map((e) => <li key={e.id}>{e.title} · {e.date}{e.end_date ? `–${e.end_date}` : ""}{e.place ? ` · ${e.place}` : ""} <button className="link-btn tiny" onClick={() => remove(e.id)}>Remove</button></li>)}</ul>}
    </section>
  );
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** Events tab: the weekly board-game night and who's booked */
export function GameNightCard() {
  const { toast } = useStore();
  type NRow = { id: number; name: string; party: number; game: string; came: number };
  const [d, setD] = useState<{ settings: { on: boolean; day: number; time: string; seats: number; note: string }; upcoming: { date: string; rows: NRow[] }[]; past: { date: string; rows: NRow[] }[] } | null>(null);
  const load = () => fetch("/api/game-night?admin=1").then((r) => (r.ok ? r.json() : null)).then((x) => x && setD(x)).catch(() => {});
  useEffect(() => { void load(); }, []);
  if (!d) return null;
  const s = d.settings;
  async function save(next: typeof s) {
    const r = await send("/api/game-night", "PUT", next);
    if (r.error) return toast(r.error);
    toast(next.on ? "Game night is on 🎲" : "Game night is off"); void load();
  }
  return (
    <section className="card" style={box}>
      <h2 className="h3" style={{ marginTop: 0 }}>🎲 Board-game night</h2>
      <p className="small muted">One evening a week. Guests book seats at <a href="/game-night" target="_blank" rel="noreferrer">/game-night</a> and pick a game from the shelf they&apos;d like, so you know what to set out.</p>
      <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem", alignItems: "end" }}>
        <label className="field small" style={{ marginBottom: 0 }}>Day<select className="input" value={s.day} onChange={(e) => setD({ ...d, settings: { ...s, day: Number(e.target.value) } })}>{DAYS.map((x, k) => <option key={k} value={k}>{x}</option>)}</select></label>
        <label className="field small" style={{ marginBottom: 0 }}>From<input className="input" type="time" value={s.time} onChange={(e) => setD({ ...d, settings: { ...s, time: e.target.value } })} /></label>
        <label className="field small" style={{ marginBottom: 0, maxWidth: "6rem" }}>Seats<input className="input" type="number" min={2} max={80} value={s.seats} onChange={(e) => setD({ ...d, settings: { ...s, seats: Number(e.target.value) } })} /></label>
        <label className="field small" style={{ marginBottom: 0, minWidth: "12rem" }}>Note for guests <span className="muted">· optional</span><input className="input" maxLength={160} value={s.note} onChange={(e) => setD({ ...d, settings: { ...s, note: e.target.value } })} placeholder="Free to join; order as you play" /></label>
        <button className="btn btn-pink btn-sm" onClick={() => save({ ...s, on: true })}>{s.on ? "Save" : "Turn it on"}</button>
        {s.on && <button className="btn btn-ghost btn-sm" onClick={() => save({ ...s, on: false })}>Turn it off</button>}
      </div>
      {s.on && d.upcoming.map((n) => (
        <p key={n.date} className="small" style={{ margin: "0.5rem 0 0" }}><b>{n.date}</b>: {n.rows.length ? n.rows.map((r) => `${r.name} (${r.party})${r.game ? ` · ${r.game}` : ""}`).join("; ") : <span className="muted">no bookings yet</span>}</p>
      ))}
      {d.past.length > 0 && (
        <>
          <p className="small" style={{ margin: "0.8rem 0 0.2rem" }}><b>Tick off who came</b> <span className="muted">(each tick is a stamp for that guest)</span></p>
          {d.past.map((n) => (
            <p key={n.date} className="small" style={{ margin: "0.2rem 0" }}>{n.date}: {n.rows.map((r) => (
              <label key={r.id} style={{ marginRight: "0.8rem", whiteSpace: "nowrap" }}><input type="checkbox" checked={!!r.came} onChange={async (e) => { const x = await send("/api/game-night", "PATCH", { id: r.id, came: e.target.checked }); if (x.error) toast(x.error); void load(); }} /> {r.name} ({r.party})</label>
            ))}</p>
          ))}
        </>
      )}
    </section>
  );
}
