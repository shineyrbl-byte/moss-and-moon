import { findBranch, parseDate, slotsFor } from "@/lib/cafe";
import { COUNTER } from "@/lib/floor";
import { tablesAt } from "@/lib/preorders";
import { tableTags } from "@/lib/tableTags";

// The floor plan for a time: which tables are free and fit the group. ?date=&time=&guests=
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const date = q.get("date") ?? "", time = q.get("time") ?? "";
  const guests = Math.min(8, Math.max(1, Math.floor(Number(q.get("guests")) || 2)));
  // The floor plan is the main café's
  if (findBranch(q.get("branch")).id !== "main") return Response.json({ tables: [], counter: COUNTER });
  if (!parseDate(date) || !slotsFor(date).includes(time)) return Response.json({ tables: [], counter: COUNTER });
  const tags = tableTags();
  return Response.json({ tables: tablesAt(date, time, guests).map((t) => ({ ...t, tags: tags[t.no] ?? [] })), counter: COUNTER });
}
