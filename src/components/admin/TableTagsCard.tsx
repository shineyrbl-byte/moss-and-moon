"use client";
import { useEffect, useState } from "react";
import { FLOOR, SEAT_TAGS, type SeatTag } from "@/lib/floor";
import { useStore } from "../Store";

/** Tables & QR tab: what each table is good for (guests filter by these when booking) */
export default function TableTagsCard({ canEdit }: { canEdit: boolean }) {
  const { toast } = useStore();
  const [tags, setTags] = useState<Record<number, SeatTag[]> | null>(null);
  const [saved, setSaved] = useState(true);
  useEffect(() => { fetch("/api/admin/table-tags").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) { setTags(d.tags); setSaved(d.saved !== false); } }).catch(() => {}); }, []);
  if (!tags) return null;
  async function toggle(no: number, tag: SeatTag) {
    const cur = tags![no] ?? [];
    const next = { ...tags!, [no]: cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag] };
    setTags(next);
    const r = await fetch("/api/admin/table-tags", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags: next }) });
    if (!r.ok) toast("Couldn't save that"); else setSaved(true);
  }
  async function confirm() {
    const r = await fetch("/api/admin/table-tags", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags }) });
    if (!r.ok) return toast("Couldn't save that");
    setSaved(true); toast("Saved: guests can see these now");
  }
  return (
    <section className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "1.1rem" }}>🪑 Seat finder</h3>
      <p className="small muted">Guests see these on the café map and when they pick a table.</p>
      {!saved && <p className="small" style={{ background: "var(--pink-soft)", padding: "0.5rem 0.7rem", borderRadius: 10 }}>These ticks are only suggestions, so guests don&apos;t see them yet. Check each table in the café (is there really a socket?), fix any that are wrong, then {canEdit ? <button className="btn btn-pink btn-sm" onClick={confirm}>Save and show guests</button> : "ask the owner to save them"}.</p>}
      <div style={{ overflowX: "auto" }}>
        <table className="tag-table">
          <thead><tr><th>Table</th>{SEAT_TAGS.map((g) => <th key={g.id}>{g.icon} {g.label}</th>)}</tr></thead>
          <tbody>
            {FLOOR.map((t) => (
              <tr key={t.no}>
                <td><b>{t.no}</b> <span className="tiny muted">{t.zone} · {t.seats}</span></td>
                {SEAT_TAGS.map((g) => (
                  <td key={g.id}><input type="checkbox" disabled={!canEdit} checked={(tags[t.no] ?? []).includes(g.id)} onChange={() => toggle(t.no, g.id)} aria-label={`Table ${t.no}: ${g.label}`} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
