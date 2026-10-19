import { currentStaff, unauthorized } from "@/lib/auth";
import { openTabs, payTab } from "@/lib/tabs";
import { publish } from "@/lib/live";

// Staff: tables with an open tab
export async function GET() {
  if (!(await currentStaff())) return unauthorized();
  return Response.json(openTabs());
}

// Staff: the table paid at the counter ({ tabId })
export async function POST(req: Request) {
  if (!(await currentStaff())) return unauthorized();
  const b = await req.json().catch(() => null);
  const codes = payTab(Number(b?.tabId), "counter", null);
  for (const code of codes) publish({ type: "order", code, action: "paid" });
  return Response.json({ ok: true, paid: codes.length, tabs: openTabs() });
}
