import { ownerGate } from "@/lib/auth";
import { goaEvents, removeGoaEvent, saveGoaEvent } from "@/lib/cafeExtras";

// What's on around Goa (?all=1 for the owner: past ones too)
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("all") === "1") { const gate = await ownerGate(); if (gate) return gate; return Response.json({ events: goaEvents(true) }); }
  return Response.json({ events: goaEvents() });
}
// Owner: { title, date, end_date?, place?, link?, note? }
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const r = saveGoaEvent(((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
// Owner: ?id=
export async function DELETE(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  return Response.json(removeGoaEvent(Number(new URL(req.url).searchParams.get("id"))));
}
