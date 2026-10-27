import { isAdmin, unauthorized } from "@/lib/auth";
import { approvals, review } from "@/lib/approvals";

// Staff: everything guests sent that's waiting for a look
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  return Response.json(approvals(), { headers: { "Cache-Control": "no-store" } });
}
// Staff: { kind, id, approve: true | false }
export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const r = review(b.kind, b.id, b.approve === true);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
