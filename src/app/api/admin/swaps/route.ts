import { db, cleanText } from "@/lib/db";
import { currentStaff, unauthorized } from "@/lib/auth";
import { toDateStr } from "@/lib/cafe";
import { overlaps, fmtTime } from "@/lib/rota";
import { ownerEmail } from "@/lib/owner";
import { sendLater } from "@/lib/email";

type Swap = { id: number; shift_id: number; from_id: number; to_id: number | null; taker_id: number | null; status: string; note: string | null; created_at: string };
type ShiftRow = { id: number; staff_id: number; day: string; start: string; end: string };
const shift = (id: number) => db.prepare("SELECT id, staff_id, day, start, end FROM shifts WHERE id = ?").get(id) as ShiftRow | undefined;
const nameOf = (id: number | null) => (id ? ((db.prepare("SELECT name FROM staff WHERE id = ?").get(id) as { name: string } | undefined)?.name ?? "Someone") : null);
const clash = (staffId: number, s: ShiftRow) => (db.prepare("SELECT start, end FROM shifts WHERE staff_id = ? AND day = ? AND id != ?").all(staffId, s.day, s.id) as { start: string; end: string }[]).some((x) => overlaps(x, s));

// Everyone: swap requests for shifts from today on
export async function GET() {
  if (!(await currentStaff())) return unauthorized();
  const rows = db.prepare(
    `SELECT w.*, s.day, s.start, s.end FROM shift_swaps w JOIN shifts s ON s.id = w.shift_id
     WHERE w.status IN ('open','taken') AND s.day >= ? ORDER BY s.day, s.start`,
  ).all(toDateStr(new Date())) as (Swap & { day: string; start: string; end: string })[];
  return Response.json(rows.map((r) => ({ ...r, fromName: nameOf(r.from_id), toName: nameOf(r.to_id), takerName: nameOf(r.taker_id) })));
}

// A barista asks to give away one of their shifts ({ shiftId, toId?, note? })
export async function POST(req: Request) {
  const me = await currentStaff();
  if (!me) return unauthorized();
  if (!me.id) return Response.json({ error: "Sign in with your own staff account to swap shifts." }, { status: 403 });
  const b = await req.json().catch(() => null);
  const s = shift(Number(b?.shiftId));
  if (!s || s.staff_id !== me.id) return Response.json({ error: "You can only swap your own shifts." }, { status: 403 });
  if (s.day < toDateStr(new Date())) return Response.json({ error: "That shift has already happened." }, { status: 400 });
  if (db.prepare("SELECT 1 FROM shift_swaps WHERE shift_id = ? AND status IN ('open','taken')").get(s.id)) return Response.json({ error: "There's already a swap request for that shift." }, { status: 409 });
  const toId = b?.toId ? Number(b.toId) : null;
  if (toId && (toId === me.id || !db.prepare("SELECT 1 FROM staff WHERE id = ? AND active = 1").get(toId))) return Response.json({ error: "Pick someone else from the team." }, { status: 400 });
  const r = db.prepare("INSERT INTO shift_swaps (shift_id, from_id, to_id, note) VALUES (?, ?, ?, ?)").run(s.id, me.id, toId, cleanText(b?.note, 120) || null);
  return Response.json({ ok: true, id: Number(r.lastInsertRowid) });
}

// { id, action: "take" (a teammate) | "approve" / "decline" (owner) | "cancel" (who asked) }
export async function PATCH(req: Request) {
  const me = await currentStaff();
  if (!me) return unauthorized();
  const b = await req.json().catch(() => null);
  const w = db.prepare("SELECT * FROM shift_swaps WHERE id = ?").get(Number(b?.id)) as Swap | undefined;
  const s = w && shift(w.shift_id);
  if (!w || !s || !["open", "taken"].includes(w.status)) return Response.json({ error: "That swap isn't open any more." }, { status: 404 });
  const set = (sql: string, ...v: (string | number | null)[]) => db.prepare(`UPDATE shift_swaps SET ${sql} WHERE id = ?`).run(...v, w.id);

  if (b?.action === "take") {
    if (!me.id || me.id === w.from_id) return Response.json({ error: "Someone else needs to take it." }, { status: 403 });
    if (w.to_id && w.to_id !== me.id) return Response.json({ error: `This one was offered to ${nameOf(w.to_id)}.` }, { status: 403 });
    if (w.status !== "open") return Response.json({ error: "Someone has already taken it." }, { status: 409 });
    if (clash(me.id, s)) return Response.json({ error: "You already have a shift then." }, { status: 409 });
    set("status = 'taken', taker_id = ?", me.id);
    const owner = ownerEmail();
    if (owner) sendLater(owner, `Shift swap to approve: ${s.day}`, `<p><b>${nameOf(w.from_id)}</b>'s shift on <b>${s.day}, ${fmtTime(s.start)}–${fmtTime(s.end)}</b> will be covered by <b>${me.name}</b>. Approve it in Staff → Rota.</p>`);
    return Response.json({ ok: true, status: "taken" });
  }
  if (b?.action === "cancel") {
    if (me.id !== w.from_id && me.role !== "owner") return Response.json({ error: "Only the person who asked can cancel." }, { status: 403 });
    set("status = 'cancelled'");
    return Response.json({ ok: true, status: "cancelled" });
  }
  if (me.role !== "owner") return Response.json({ error: "Only the owner can do that." }, { status: 403 });
  if (b?.action === "decline") { set("status = 'declined'"); return Response.json({ ok: true, status: "declined" }); }
  if (b?.action === "approve") {
    if (w.status !== "taken" || !w.taker_id) return Response.json({ error: "Nobody has taken it yet." }, { status: 409 });
    if (clash(w.taker_id, s)) return Response.json({ error: `${nameOf(w.taker_id)} now has another shift then.` }, { status: 409 });
    db.prepare("UPDATE shifts SET staff_id = ? WHERE id = ?").run(w.taker_id, s.id);
    set("status = 'approved'");
    return Response.json({ ok: true, status: "approved" });
  }
  return Response.json({ error: "Unknown action." }, { status: 400 });
}
