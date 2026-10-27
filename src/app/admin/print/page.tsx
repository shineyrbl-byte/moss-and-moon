import "./page.css";
import Link from "next/link";
import { currentStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { findEvent } from "@/lib/eventsStore";
import { nightSettings } from "@/lib/cafeExtras";
import { shelf } from "@/lib/library";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

// Staff: a printable guest list for an event (?event=id) or a board-game night (?night=YYYY-MM-DD), with boxes to tick at the door
export default async function PrintSheet({ searchParams }: { searchParams: Promise<{ event?: string; night?: string }> }) {
  if (!(await currentStaff())) return <div className="page"><p>Please <Link href="/admin">sign in to the staff dashboard</Link> first.</p></div>;
  const q = await searchParams;
  let title = "", when = "", rows: { name: string; n: number; note: string; done: boolean }[] = [];
  if (q.event) {
    const ev = findEvent(q.event);
    if (!ev) return <div className="page"><p>We couldn&apos;t find that event.</p></div>;
    title = ev.title; when = new Date(`${ev.date}T${ev.time}`).toLocaleString("en-IN", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
    rows = (db.prepare("SELECT name, qty, code, checked_in FROM tickets WHERE event_id = ? AND (paid = 1 OR amount = 0) ORDER BY name COLLATE NOCASE").all(q.event) as { name: string; qty: number; code: string; checked_in: number }[])
      .map((t) => ({ name: t.name, n: t.qty, note: t.code, done: !!t.checked_in }));
  } else if (q.night && /^\d{4}-\d{2}-\d{2}$/.test(q.night)) {
    const games = new Map(shelf().map((g) => [g.id, g.title]));
    title = "Board-game night"; when = `${new Date(`${q.night}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}, from ${nightSettings().time}`;
    rows = (db.prepare("SELECT name, party, game, came FROM game_night WHERE date = ? ORDER BY name COLLATE NOCASE").all(q.night) as { name: string; party: number; game: string; came: number }[])
      .map((r) => ({ name: r.name, n: r.party, note: r.game ? games.get(r.game) ?? r.game : "", done: !!r.came }));
  } else return <div className="page"><p>Pick an event or a game night to print from the dashboard.</p></div>;
  const total = rows.reduce((s, r) => s + r.n, 0);
  return (
    <div className="page print-sheet" style={{ maxWidth: "44rem" }}>
      <p className="no-print small"><Link href="/admin">← Dashboard</Link> · <PrintButton /></p>
      <h1 className="h2" style={{ marginBottom: "0.2rem" }}>{title}</h1>
      <p className="small">{when} · {rows.length} booking{rows.length === 1 ? "" : "s"}, {total} {q.event ? "place" : "seat"}{total === 1 ? "" : "s"}</p>
      <table className="st-table">
        <thead><tr><th scope="col" style={{ width: "2.2rem" }}>✓</th><th scope="col">Name</th><th scope="col">{q.event ? "Places" : "Seats"}</th><th scope="col">{q.event ? "Ticket code" : "Wants to play"}</th></tr></thead>
        <tbody>{rows.map((r, k) => <tr key={k}><td><span className="ps-box">{r.done ? "✓" : ""}</span></td><td>{r.name}</td><td>{r.n}</td><td>{r.note}</td></tr>)}</tbody>
      </table>
      {!rows.length && <p className="muted">No bookings yet.</p>}
      <p className="tiny muted">Printed {new Date().toLocaleString("en-IN")}. {q.event ? "Ticks show who's already checked in." : "Ticks show who's been marked as here."}</p>
    </div>
  );
}
