"use client";
import "./page.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/Store";
import { voterId } from "@/components/LabCard";
import { addFlag } from "@/lib/trophyFlags";

type Night = { date: string; left: number; wanted: { id: string; title: string; n: number }[]; mine: { party: number; game: string; name: string } | null };
type GN = { on: false } | { on: true; time: string; seats: number; note: string; nights: Night[]; stamps: number; alerts: boolean; games: { id: string; title: string }[] };
const toKey = (base64: string) => { const raw = atob((base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };

export default function GameNight() {
  const { toast } = useStore();
  const [g, setG] = useState<GN | null>(null);
  const [form, setForm] = useState({ date: "", name: "", party: 2, game: "" });
  useEffect(() => {
    try { setForm((f) => ({ ...f, name: localStorage.getItem("mm-game-name") ?? "" })); } catch {}
    fetch(`/api/game-night?voter=${voterId()}`).then((r) => r.json()).then((d: GN) => { setG(d); if (d.on) setForm((f) => ({ ...f, date: d.nights[0].date })); }).catch(() => setG({ on: false }));
  }, []);
  useEffect(() => { if (g?.on && g.stamps >= 5) addFlag("game-night-5"); }, [g]);
  async function remind(on: boolean) {
    try {
      let subscription: PushSubscriptionJSON | null = null;
      if (on) {
        if (!("serviceWorker" in navigator && "PushManager" in window && "Notification" in window)) return toast("This browser can't show reminders. On an iPhone, add the site to your home screen first.");
        if ((await Notification.requestPermission()) !== "granted") return toast("Notifications are blocked for this site in your browser settings.");
        const reg = await navigator.serviceWorker.ready, { publicKey } = await fetch("/api/push").then((r) => r.json());
        subscription = ((await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }))).toJSON();
      }
      await post({ subscription }, on ? "🔔 We'll remind you the day before" : "Reminders off");
    } catch { toast("Couldn't turn on reminders on this browser."); }
  }
  async function post(body: Record<string, unknown>, done: string) {
    const r = await fetch("/api/game-night", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voter: voterId(), ...body }) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setG(d); toast(done);
  }
  const nice = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  if (!g) return <div className="page"><p className="muted">Setting out the boards…</p></div>;
  if (!g.on) return (
    <div className="page" style={{ maxWidth: "36rem" }}>
      <p className="eyebrow">board-game night</p>
      <h1 className="h2">Game <em>night</em></h1>
      <p className="card">There&apos;s no board-game night on the calendar right now. You can still borrow a game with your table any day: see <Link href="/shelf">games &amp; books</Link>.</p>
    </div>
  );
  const sel = g.nights.find((n) => n.date === form.date) ?? g.nights[0];
  return (
    <div className="page" style={{ maxWidth: "38rem" }}>
      <p className="eyebrow">board-game night</p>
      <h1 className="h2">Game <em>night</em></h1>
      <p className="small muted">Every week from {g.time}, with the games from our <Link href="/shelf">shelf</Link>. Book your seats and tell us what you&apos;d like to play, so the team can set it out.{g.note ? ` ${g.note}` : ""}</p>
      {g.stamps > 0 && (
        <p className="gn-stamps" aria-label={`${g.stamps} game night${g.stamps === 1 ? "" : "s"} so far`}>
          {[...Array(Math.max(5, Math.ceil(g.stamps / 5) * 5)).keys()].map((k) => <span key={k} className={k < g.stamps ? "on" : ""} aria-hidden="true">{k < g.stamps ? "🎲" : ""}</span>)}
          <small>{g.stamps} game night{g.stamps === 1 ? "" : "s"} so far</small>
        </p>
      )}
      <ul className="games-more" style={{ marginTop: "0.6rem" }}>
        {g.nights.map((n) => (
          <li key={n.date}>
            <b>{nice(n.date)}</b> · {n.left ? `${n.left} of ${g.seats} seats left` : "full"}
            {n.mine && <span className="tiny"> · you&apos;re booked ({n.mine.party}) <button className="link-btn tiny" onClick={() => post({ date: n.date, cancel: true }, "Booking cancelled")}>Cancel</button></span>}
            {n.wanted.length > 0 && <><br /><span className="tiny muted">Wanted: {n.wanted.slice(0, 4).map((w) => `${w.title} (${w.n})`).join(", ")}</span></>}
          </li>
        ))}
      </ul>
      <form className="card" style={{ padding: "1rem 1.2rem", display: "grid", gap: "0.6rem", marginTop: "0.8rem" }} onSubmit={(e) => { e.preventDefault(); try { localStorage.setItem("mm-game-name", form.name); } catch {} void post({ date: sel.date, name: form.name, party: form.party, game: form.game }, "Booked 🎲 See you there!"); }}>
        <h2 className="h3" style={{ margin: 0 }}>{sel.mine ? "Change your booking" : "Book seats"}</h2>
        <label className="field">Night<select className="input" value={sel.date} onChange={(e) => setForm({ ...form, date: e.target.value })}>{g.nights.map((n) => <option key={n.date} value={n.date} disabled={!n.left && !n.mine}>{nice(n.date)}{!n.left && !n.mine ? " (full)" : ""}</option>)}</select></label>
        <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
          <label className="field" style={{ maxWidth: "12rem" }}>Name<input className="input" required maxLength={30} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Riya" /></label>
          <label className="field" style={{ maxWidth: "7rem" }}>Seats<select className="input" value={form.party} onChange={(e) => setForm({ ...form, party: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}</select></label>
        </div>
        <label className="field">Game you&apos;d like <span className="muted small">· optional</span><select className="input" value={form.game} onChange={(e) => setForm({ ...form, game: e.target.value })}><option value="">Surprise us</option>{g.games.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
        <button className="btn btn-pink">{sel.mine ? "Update booking" : "Book"}</button>
        <p className="tiny muted" style={{ margin: 0 }}>Only your name and seats are kept, for the team&apos;s list. Your booking is tied to this browser, so you can change or cancel it here. Each night the team ticks you off as there gives you a stamp.</p>
      </form>
      {g.nights.some((n) => n.mine) && <p className="center"><button className="btn btn-ghost btn-sm" aria-pressed={g.alerts} onClick={() => remind(!g.alerts)}>{g.alerts ? "🔕 No reminders" : "🔔 Remind me the day before"}</button></p>}
    </div>
  );
}
