import { ownerGate } from "@/lib/auth";
import { addSpot, allSpots, removeSpot, todaysSpot } from "@/lib/goaSpots";
import { savePhoto } from "@/lib/uploads";

// Today's photo (?all=1 for the owner: every spot, with answers)
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("all")) { const gate = await ownerGate(); if (gate) return gate; return Response.json({ spots: allSpots() }); }
  return Response.json(todaysSpot(), { headers: { "Cache-Control": "no-store" } });
}
// Owner: a form with a photo (file), answer, wrong1–3 and an optional note
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: "Please choose a photo." }, { status: 400 });
  const saved = await savePhoto(form.get("file"), 8);
  if ("error" in saved) return Response.json(saved, { status: 400 });
  const r = addSpot(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")), saved.url);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
// Owner: { id }
export async function DELETE(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = (await req.json().catch(() => null)) ?? {};
  return Response.json({ ok: removeSpot(Number(b.id)), spots: allSpots() });
}
