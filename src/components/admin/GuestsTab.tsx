"use client";
import { Fragment, useCallback, useEffect, useState } from "react";
import { rupees } from "@/lib/pricing";
import { useStore } from "../Store";

type G = { key: string; name: string; phone: string | null; email: string | null; visits: number; spend: number; avg: number; first: string; last: string; favourite: string | null; birthday: string | null; stamps: number; vip: boolean; note: string | null; account: boolean };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const bday = (b: string | null) => (b ? `${Number(b.slice(3, 5))} ${MONTHS[Number(b.slice(0, 2)) - 1]}` : "");

/** Owner: your regulars, with visits, spend, favourites, birthdays, VIP stars and notes */
export default function GuestsTab() {
  const { toast } = useStore();
  const [d, setD] = useState<{ total: number; guests: G[]; birthdays: { name: string; birthday: string }[] } | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("spend");
  const [vipOnly, setVipOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    const p = new URLSearchParams({ q, sort, ...(vipOnly ? { vip: "1" } : {}) });
    fetch(`/api/admin/guests?${p}`).then((r) => r.json()).then(setD).catch(() => {});
  }, [q, sort, vipOnly]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function patch(key: string, body: { vip?: boolean; note?: string }) {
    const r = await fetch("/api/admin/guests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, ...body }) });
    if (!r.ok) return toast((await r.json()).error);
    if (body.note !== undefined) toast("Note saved ✓");
    load();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {!!d?.birthdays.length && <div className="reward-banner">🎂 Birthdays this month: {d.birthdays.map((b) => `${b.name} (${bday(b.birthday)})`).join(", ")}</div>}
      <div className="row" style={{ alignItems: "center" }}>
        <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Search name, phone, email or note" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search guests" />
        <div className="chips" role="radiogroup" aria-label="Sort">
          {[["spend", "Top spenders"], ["visits", "Most visits"], ["recent", "Recent"]].map(([k, l]) => <button key={k} role="radio" aria-checked={sort === k} className={`chip ${sort === k ? "on" : ""}`} onClick={() => setSort(k)}>{l}</button>)}
          <button className={`chip ${vipOnly ? "on" : ""}`} aria-pressed={vipOnly} onClick={() => setVipOnly((v) => !v)}>⭐ VIPs</button>
        </div>
        <a className="btn btn-ghost btn-sm" href={`/api/admin/guests?format=csv&sort=${sort}`}>⬇ CSV</a>
      </div>
      {d && <p className="small muted">{d.total} guest{d.total === 1 ? "" : "s"}{d.total > d.guests.length ? `, showing the first ${d.guests.length}` : ""}</p>}
      <div className="rota-wrap">
        <table className="rota guests" style={{ minWidth: 720 }}>
          <thead><tr><th scope="col">Guest</th><th scope="col">Visits</th><th scope="col">Spend</th><th scope="col">Avg</th><th scope="col">Last visit</th><th scope="col">Favourite</th><th scope="col"><span className="sr-only">VIP</span></th></tr></thead>
          <tbody>
            {d?.guests.map((g) => (
              <Fragment key={g.key}>
                <tr className={open === g.key ? "me" : ""} onClick={() => { setOpen(open === g.key ? null : g.key); setNote(g.note ?? ""); }} style={{ cursor: "pointer" }}>
                  <th scope="row">{g.name}{g.account ? " 👤" : ""}{g.birthday ? <span className="muted small"> · 🎂 {bday(g.birthday)}</span> : null}<br /><span className="muted small">{g.phone ?? g.email ?? ""}</span></th>
                  <td>{g.visits}</td><td>{rupees(g.spend)}</td><td>{rupees(g.avg)}</td>
                  <td>{new Date(g.last.replace(" ", "T")).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                  <td className="small">{g.favourite ?? ""}</td>
                  <td><button className={`vip-star ${g.vip ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); patch(g.key, { vip: !g.vip }); }} aria-pressed={g.vip} aria-label={`${g.vip ? "Remove" : "Make"} ${g.name} a VIP`}>{g.vip ? "★" : "☆"}</button></td>
                </tr>
                {open === g.key && (
                  <tr>
                    <td colSpan={7}>
                      <div className="row" style={{ alignItems: "center" }}>
                        <span className="small muted">First visit {g.first.slice(0, 10)}{g.email ? ` · ${g.email}` : ""}{g.stamps ? ` · ${g.stamps} stamps` : ""}</span>
                        <input className="input" style={{ flex: 1, minWidth: 220 }} maxLength={200} placeholder="A note for the team, e.g. oat flat white, extra hot, likes the window seat" value={note} onChange={(e) => setNote(e.target.value)} aria-label={`Note about ${g.name}`} />
                        <button className="btn btn-ghost btn-sm" onClick={() => patch(g.key, { note })}>Save note</button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {d && !d.guests.length && <tr><td colSpan={7} className="muted">No guests yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
