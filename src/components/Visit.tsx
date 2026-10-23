"use client";
import { useEffect, useState } from "react";
import { findBranch, hoursLabel, openStatus, toDateStr } from "@/lib/cafe";
import BranchPicker from "./BranchPicker";
import { useStore } from "./Store";
import { fill } from "@/lib/i18n";
import Reveal from "./Reveal";
import BusyMeter from "./BusyMeter";
import TablePicker from "./TablePicker";
import { unitPrice, rupees } from "@/lib/pricing";
import { usePay } from "./Payment";
import { DEPOSIT } from "@/lib/cafe";
import AddToCalendar from "./AddToCalendar";

type Slot = { time: string; left: number };
type Booked = { code: string; name: string; date: string; time: string; guests: number; table: number | null; preorderText: string | null ; game?: string | null; dog?: boolean };

export default function Visit() {
  const { toast, t, lines, find, clear, branch, lang } = useStore();
  const here = findBranch(branch);
  const [table, setTable] = useState<number | null>(null);
  const pay = usePay();
  const [unpaid, setUnpaid] = useState<(Booked & { deposit: number }) | null>(null);
  const [preorder, setPreorder] = useState(false);
  const [today, setToday] = useState("");
  const [status, setStatus] = useState<{ open: boolean; text: string } | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", date: "", time: "", guests: 2, note: "", highChairs: 0, game: "", dog: false });
  // Board games from the shelf (taken ones are marked once a time is picked); ?game=… from the shelf page picks one
  const [games, setGames] = useState<{ id: string; title: string; detail: string; out: number; taken: boolean }[]>([]);
  useEffect(() => { const g = new URLSearchParams(location.search).get("game"); if (g) setForm((f) => ({ ...f, game: g })); }, []);
  useEffect(() => {
    const qs = form.date && form.time ? `?date=${form.date}&time=${form.time}` : "";
    fetch(`/api/shelf${qs}`).then((r) => r.json()).then((d) => setGames((d.items ?? []).filter((i: { kind: string }) => i.kind === "game"))).catch(() => {});
  }, [form.date, form.time]);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [booked, setBooked] = useState<Booked | null>(null);
  const [waitlisted, setWaitlisted] = useState<number | null>(null);

  useEffect(() => {
    const t = toDateStr(new Date());
    setToday(t);
    setForm((f) => ({ ...f, date: t }));
  }, []);
  useEffect(() => { setStatus(openStatus(new Date(), branch, lang)); setForm((f) => ({ ...f, time: "" })); setTable(null); }, [branch]);
  useEffect(() => { setStatus(openStatus(new Date(), branch, lang)); }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load free times whenever the date changes
  useEffect(() => {
    if (!form.date) return;
    setSlots(null);
    fetch(`/api/bookings/availability?date=${form.date}&branch=${branch}`).then((r) => r.json()).then(setSlots).catch(() => setSlots([]));
  }, [form.date, booked, branch]);

  const need = form.guests >= 5 ? 2 : 1;
  const foodLines = lines.filter((l) => { const m = find(l.itemId); return m && m.cat !== "shop"; });
  const trayTotal = foodLines.reduce((s, l) => s + unitPrice(find(l.itemId)!, l.opts) * l.qty, 0);
  const chosen = slots?.find((s) => s.time === form.time);
  const full = !!chosen && chosen.left < need;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.time) return setError("Please pick a time.");
    setBusy(true);
    setError("");
    if (full) {
      // That slot is full: join the waitlist instead
      const r = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, branch }) });
      const d = await r.json();
      setBusy(false);
      if (!r.ok) return setError(d.error);
      setWaitlisted(d.position);
      toast("You're on the waitlist ✿");
      return;
    }
    const pre = preorder ? lines.filter((l) => find(l.itemId)?.cat !== "shop").map(({ itemId, opts, qty }) => ({ itemId, opts, qty })) : [];
    const r = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, branch, table: branch === "main" ? table : null, preorder: pre }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setError(d.error);
    if (d.needsDeposit) {
      setUnpaid(d);
      const ok = await pay("booking", d.code, { name: form.name, email: form.email, phone: form.phone });
      if (!ok) return;
      setUnpaid(null);
      toast("Deposit paid. Table booked! 🌸");
    }
    setBooked(d);
    setTable(null);
    if (pre.length) { clear(); setPreorder(false); }
    toast("Table booked! See you soon 🌸");
  }

  const weekdayIdx = new Date().getDay();
  // Which row of the hours list is today (rows group days with the same hours, Monday first)
  const rows = hoursLabel(branch);
  const mondayFirst = (d: number) => (d + 6) % 7;
  const todayRow = rows.findIndex((r) => mondayFirst(weekdayIdx) >= mondayFirst(r.from) && mondayFirst(weekdayIdx) <= mondayFirst(r.to));

  return (
    <Reveal id="visit" className="section visit">
      <div>
        <p className="eyebrow">{t("visit.eyebrow")}</p>
        <h2>{t("visit.title1")} <em>{t("visit.title2")}</em></h2>
        <BranchPicker label="Visit" />
        <p className="lead">{branch === "main" ? `${here.address}, your favourite neighbourhood. Look for the pink door and the bicycles outside.` : `${here.name}: ${here.address}`}</p>
        <ul className="hours">
          {rows.map((h, i) => (
            <li key={h.days} className={status && i === todayRow ? "today" : ""}><span>{h.days}</span><span>{h.time}</span></li>
          ))}
        </ul>
        {status && (
          <div className="status-pill"><span className={`dot ${status.open ? "" : "closed"}`} />{status.text}</div>
        )}
        <BusyMeter />
        <div className="map">
          <iframe title="Map" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=73.8%2C15.38%2C73.84%2C15.4&layer=mapnik" />
        </div>
      </div>

      <div className="booking card">
        {waitlisted !== null ? (
          <div className="confirm">
            <span className="big">⏳</span>
            <h3>You&apos;re #{waitlisted} on the waitlist</h3>
            <p className="muted">If a table opens up at {form.time}, we&apos;ll email {form.email} straight away.</p>
            <button className="btn btn-ghost btn-sm" onClick={() => { setWaitlisted(null); setForm((f) => ({ ...f, time: "" })); }}>Pick another time</button>
          </div>
        ) : unpaid ? (
          <div className="confirm">
            <span className="big">⏳</span>
            <h3>Almost there, {unpaid.name}</h3>
            <p className="muted">Groups of {DEPOSIT.minGuests}+ pay a {rupees(unpaid.deposit)} deposit to hold the table. It comes off your bill. We&apos;ll hold it for {DEPOSIT.holdMinutes} minutes.</p>
            <button className="btn btn-pink" onClick={async () => { if (await pay("booking", unpaid.code, { name: form.name, email: form.email, phone: form.phone })) { setBooked(unpaid); setUnpaid(null); toast("Deposit paid. Table booked! 🌸"); } }}>Pay {rupees(unpaid.deposit)} deposit</button>
          </div>
        ) : booked ? (
          <div className="confirm">
            <span className="big">🌸</span>
            <h3>See you soon, {booked.name}!</h3>
            <p className="muted">
              {booked.table ? `Table ${booked.table}` : "Table"} for {booked.guests} on{" "}
              {new Date(booked.date + "T00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} at {booked.time}
            </p>
            {booked.preorderText && <p className="small">🍽 Ready when you arrive: {booked.preorderText}</p>}
            {booked.game && <p className="small">🎲 {fill(t("visit.gameKept"), { game: booked.game })}</p>}
            {booked.dog && <p className="small">🐾 {t("visit.dogKept")}</p>}
            <span className="code">{booked.code}</span>
            <p className="small muted">Show this code when you arrive.</p>
            <AddToCalendar event={{ uid: booked.code, title: `Table for ${booked.guests} at Moss & Moon`, date: booked.date, time: booked.time, minutes: 90, details: `Booking ${booked.code}. Show this code when you arrive.`, alarmMinutes: 60 }} />
            <button className="btn btn-ghost btn-sm" onClick={() => { setBooked(null); setForm((f) => ({ ...f, time: "", note: "", dog: false })); }}>Book another</button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h3>{t("visit.reserve")}</h3>
            <div className="row">
              <label className="field">{t("visit.name")}<input className="input" required maxLength={40} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="field">{t("visit.phone")}<input className="input" required inputMode="numeric" placeholder={t("visit.phonePh")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            </div>
            <div className="row">
              <label className="field">{t("visit.date")}<input className="input" type="date" required min={today} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value, time: "" })} /></label>
              <label className="field">{t("visit.guests")}
                <select className="input" value={form.guests} onChange={(e) => setForm({ ...form, guests: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n} {n === 1 ? "guest" : "guests"}</option>)}
                </select>
              </label>
            </div>
            <div className="field">
              Time
              {slots === null ? (
                <span className="small">{t("visit.checking")}</span>
              ) : slots.length === 0 ? (
                <span className="small">{t("visit.noTimes")}</span>
              ) : (
                <div className="slots">
                  {slots.map((s) => (
                    <button type="button" key={s.time} className={`chip ${form.time === s.time ? "on" : ""} ${s.left < need ? "is-full" : ""}`} onClick={() => setForm({ ...form, time: s.time })}>
                      {s.time}
                      <small>{s.left < need ? "full · waitlist" : `${s.left} left`}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!full && branch === "main" && <TablePicker date={form.date} time={form.time} guests={form.guests} value={table} onChange={setTable} prefer={form.dog ? ["dog"] : []} />}
            {!full && form.time && foodLines.length > 0 && (
              <label className="addon" style={{ alignItems: "flex-start" }}>
                <input type="checkbox" checked={preorder} onChange={(e) => setPreorder(e.target.checked)} />
                <span>{t("visit.trayReady")} <span className="muted small">· {foodLines.reduce((s, l) => s + l.qty, 0)} item{foodLines.reduce((s, l) => s + l.qty, 0) === 1 ? "" : "s"}, about {rupees(trayTotal)}, pay at the café. We start it 15 minutes before.</span></span>
              </label>
            )}
            {!full && form.time && !foodLines.length && <p className="tiny muted">{t("visit.trayTip")}</p>}
            {!full && form.guests >= DEPOSIT.minGuests && <p className="small muted">For {DEPOSIT.minGuests} or more we take a {rupees(form.guests * DEPOSIT.perGuest)} deposit online. It comes off your bill.</p>}
            {full && <p className="reward-banner small">⏳ {form.time} is fully booked. Join the waitlist and we&apos;ll email you if a table opens up.</p>}
            <label className="field">{full ? t("visit.emailFull") : t("visit.email")}<input className="input" type="email" required={full || form.guests >= DEPOSIT.minGuests} placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="row small" style={{ alignItems: "center", gap: "0.5rem" }}>
              <input type="checkbox" checked={form.highChairs > 0} onChange={(e) => setForm({ ...form, highChairs: e.target.checked ? 1 : 0 })} /> {t("visit.highChair")}
              {form.highChairs > 0 && <select className="input" style={{ width: "auto" }} value={form.highChairs} onChange={(e) => setForm({ ...form, highChairs: Number(e.target.value) })} aria-label="How many high chairs">{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select>}
            </label>
            <label className="row small" style={{ alignItems: "center", gap: "0.5rem" }}>
              <input type="checkbox" checked={form.dog} onChange={(e) => setForm({ ...form, dog: e.target.checked })} /> {t("visit.dog")}
            </label>
            {!full && games.length > 0 && (
              <div className="field">
                <label htmlFor="visit-game">{t("visit.game")} <span className="muted small">{t("opt.optional")}</span></label>
                <select id="visit-game" className="input" value={form.game} onChange={(e) => setForm({ ...form, game: e.target.value })}>
                  <option value="">{t("visit.noGame")}</option>
                  {games.map((g) => <option key={g.id} value={g.id} disabled={!!g.out || g.taken}>{g.title} · {g.detail}{g.taken ? ` · ${t("visit.gameTaken")}` : g.out ? ` · ${t("visit.gameOut")}` : ""}</option>)}
                </select>
              </div>
            )}
            <label className="field">{t("visit.note")}<textarea className="input" rows={2} maxLength={200} placeholder={t("visit.notePh")} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
            {error && <p className="error">{error}</p>}
            <button className="btn btn-pink full" disabled={busy}>{busy ? t("visit.oneMoment") : full ? t("visit.waitlist") : t("visit.reserveBtn")}</button>
          </form>
        )}
      </div>
    </Reveal>
  );
}
