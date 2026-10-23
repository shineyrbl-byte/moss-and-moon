"use client";
import { useEffect, useState } from "react";
import { FLOOR, SEAT_TAGS, type SeatTag } from "@/lib/floor";
import { useStore } from "../Store";

/** Tables & QR tab: what each table is good for (guests filter by these when booking) */
export default function TableTagsCard({ canEdit }: { canEdit: boolean }) {
  const { toast } = useStore();
  const [tags, setTags] = useState<Record<number, SeatTag[]> | null>(null);
  useEffect(() => { fetch("/api/admin/table-tags").then((r) => (r.ok ? r.json() : null)).then((d) => d && setTags(d.tags)).catch(() => {}); }, []);
  if (!tags) return null;
  async function toggle(no: number, tag: SeatTag) {
    const cur = tags![no] ?? [];
    const next = { ...tags!, [no]: cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag] };
    setTags(next);
    const r = await fetch("/api/admin/table-tags", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags: next }) });
    if (!r.ok) toast("Couldn't save that");
  }
  return (
    <section className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
      <h3 style={{ fontSize: "1.1rem" }}>🪑 Seat finder</h3>
      <p className="small muted">Guests can look for these when they pick a table.</p>
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
