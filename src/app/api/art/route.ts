import { ownerGate } from "@/lib/auth";
import { addArtwork, artistOfMonth, artworks, removeArtwork, saveArtist, setSold } from "@/lib/artStore";
import { savePhoto } from "@/lib/uploads";

// This month's artist and the pieces on the walls
export async function GET() {
  return Response.json({ artist: artistOfMonth(), works: artworks() });
}

// Owner: add a piece (form: file, title, medium, size, price)
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: "Please choose a photo." }, { status: 400 });
  const saved = await savePhoto(form.get("file"), 8);
  if ("error" in saved) return Response.json(saved, { status: 400 });
  const r = addArtwork(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")), saved.url);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Owner: { artist: { name, bio, link } } or { id, sold }
export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = (await req.json().catch(() => null)) ?? {};
  if (b.artist) return Response.json({ artist: saveArtist(b.artist) });
  const ok = setSold(Number(b.id), !!b.sold);
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}

// Owner: take a piece down (?id=)
export async function DELETE(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const ok = removeArtwork(Number(new URL(req.url).searchParams.get("id")));
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
