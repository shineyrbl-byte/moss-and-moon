import { isOwner, ownerGate } from "@/lib/auth";
import { hintsForOwner, parcels, saveHints, unwrap } from "@/lib/blindDateStore";

// Wrapped books with their hints (no titles). Owner: ?owner=1 for every book and its hints.
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("owner") === "1") {
    if (!(await isOwner())) return Response.json({ error: "Only the owner can do that." }, { status: 403 });
    return Response.json({ books: hintsForOwner() });
  }
  return Response.json({ parcels: parcels() });
}

// { id }: unwrap one and see what it is
export async function POST(req: Request) {
  const b = unwrap(((await req.json().catch(() => null)) ?? {}).id);
  return b ? Response.json(b) : Response.json({ error: "That book isn't wrapped." }, { status: 404 });
}

// Owner: { id, hints: [up to 3] } (no hints takes it off the blind-date shelf)
export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = (await req.json().catch(() => null)) ?? {};
  const r = saveHints(b.id, b.hints);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
