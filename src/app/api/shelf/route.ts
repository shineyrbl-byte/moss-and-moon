import { ownerGate } from "@/lib/auth";
import { deleteShelfItem, gamesTaken, saveShelfItem, shelf } from "@/lib/library";

// The shelf. With ?date=YYYY-MM-DD&time=HH:MM, games already promised to another table are marked taken.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const date = u.searchParams.get("date") ?? "", time = u.searchParams.get("time") ?? "";
  const taken = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time) ? gamesTaken(date, time) : new Set<string>();
  return Response.json({ items: shelf().map((i) => ({ ...i, taken: taken.has(i.id) })) });
}

// Owner: add or edit a game or book
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const r = saveShelfItem((await req.json().catch(() => null)) ?? {});
  if ("error" in r) return Response.json(r, { status: 400 });
  return Response.json({ ok: true, item: r });
}

// Owner: remove one (?id=)
export async function DELETE(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const ok = deleteShelfItem(new URL(req.url).searchParams.get("id") ?? "");
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
