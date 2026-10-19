import { ownerGate } from "@/lib/auth";
import { isPlatform, platformMenuCsv } from "@/lib/aggregators";

// Owner: the menu as a spreadsheet for listing on Swiggy or Zomato (?platform=swiggy)
export async function GET(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const p = new URL(req.url).searchParams.get("platform");
  if (!isPlatform(p)) return Response.json({ error: "Pick Swiggy or Zomato." }, { status: 400 });
  return new Response("﻿" + platformMenuCsv(p), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="moss-and-moon-${p}-menu.csv"` } });
}
