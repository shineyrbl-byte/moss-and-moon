import "./page.css";
import Link from "next/link";
import { COUNTER, FLOOR, SEAT_TAGS } from "@/lib/floor";
import { tableTags } from "@/lib/tableTags";

export const dynamic = "force-dynamic";

// The floor plan guests see when they book, with what each table is good for (the team keeps the tags up to date)
export default function CafeMap() {
  const tags = tableTags(), anyTags = Object.values(tags).some((x) => x.length);
  const zones = [...new Set(FLOOR.map((t) => t.zone))];
  return (
    <div className="page" style={{ maxWidth: "44rem" }}>
      <p className="eyebrow">find your spot</p>
      <h1 className="h2">The café <em>map</em></h1>
      <p className="small muted">Where everything is at our Willow Lane café. The icons show which tables have a power socket, a window, a quiet spot or room for a dog, as the team has marked them. You can pick a table when you <Link href="/#visit">book</Link>.</p>
      <div className="cm-plan" role="img" aria-label={`Floor plan: ${FLOOR.map((t) => `table ${t.no}, ${t.seats} seats, ${t.zone}${tags[t.no]?.length ? `, ${tags[t.no].map((x) => SEAT_TAGS.find((s) => s.id === x)!.label.toLowerCase()).join(", ")}` : ""}`).join("; ")}. The counter is at the front.`}>
        {FLOOR.map((t) => (
          <div key={t.no} className={`cm-table ${t.round ? "round" : ""}`} style={{ left: `${t.x}%`, top: `${t.y}%`, width: `${t.w}%`, height: `${t.h}%` }}>
            <b>{t.no}</b><small>{t.seats} seats</small>
            <span className="cm-tags">{(tags[t.no] ?? []).map((x) => SEAT_TAGS.find((s) => s.id === x)!.icon).join(" ")}</span>
          </div>
        ))}
        <div className="cm-counter" style={{ left: `${COUNTER.x}%`, top: `${COUNTER.y}%`, width: `${COUNTER.w}%`, height: `${COUNTER.h}%` }}>☕ Counter</div>
      </div>
      {anyTags ? <p className="small" style={{ display: "flex", flexWrap: "wrap", gap: "0.8rem" }}>{SEAT_TAGS.map((s) => <span key={s.id}>{s.icon} {s.label}</span>)}</p>
        : <p className="small muted">Which tables have a socket, a window, a quiet spot or room for a dog will show here once the team has marked them. Just ask at the counter for now.</p>}
      <h2 className="h3" style={{ marginTop: "1.2rem" }}>Table by table</h2>
      <ul className="small">
        {zones.map((z) => (
          <li key={z}><b>{z}</b>: {FLOOR.filter((t) => t.zone === z).map((t) => `table ${t.no} (${t.seats})${tags[t.no]?.length ? ` ${tags[t.no].map((x) => SEAT_TAGS.find((s) => s.id === x)!.icon).join("")}` : ""}`).join(", ")}</li>
        ))}
      </ul>
    </div>
  );
}
