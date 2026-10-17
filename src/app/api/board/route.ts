import { db } from "@/lib/db";

// Public data for the "Now serving" TV board: order codes + first names only.
export async function GET() {
  const rows = db
    .prepare(
      `SELECT code, name, status, table_no, ready_at FROM orders
       WHERE created_at >= datetime('now','localtime','-6 hours')
         AND (status IN ('received','brewing')
              OR (status = 'ready' AND ready_at >= datetime('now','localtime','-30 minutes')))
       ORDER BY id`
    )
    .all() as { code: string; name: string; status: string; table_no: number | null; ready_at: string | null }[];
  const first = (n: string) => n.trim().split(/\s+/)[0]?.slice(0, 14) ?? "";
  const pick = (r: (typeof rows)[number]) => ({ code: r.code, name: first(r.name), table: r.table_no });
  return Response.json({
    preparing: rows.filter((r) => r.status !== "ready").map(pick),
    ready: rows.filter((r) => r.status === "ready").sort((a, b) => String(b.ready_at).localeCompare(String(a.ready_at))).map(pick),
  });
}
