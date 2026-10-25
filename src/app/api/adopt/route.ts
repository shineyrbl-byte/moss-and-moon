import { ownerGate } from "@/lib/auth";
import { addPet, petsAvailable, petsHomed, removePet, setAdopted } from "@/lib/petStore";
import { savePhoto } from "@/lib/uploads";

// Who's looking for a home, and who's found one
export async function GET() {
  return Response.json({ pets: petsAvailable(), homed: petsHomed() });
}

// Owner: a form with a photo (file) and name, kind, age, about, good_with, shelter, link
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: "Please choose a photo." }, { status: 400 });
  const saved = await savePhoto(form.get("file"), 8);
  if ("error" in saved) return Response.json(saved, { status: 400 });
  const r = addPet(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")), saved.url);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

// Owner: { id, adopted }
export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = (await req.json().catch(() => null)) ?? {};
  const ok = setAdopted(Number(b.id), !!b.adopted);
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}

// Owner: remove one (?id=)
export async function DELETE(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const ok = removePet(Number(new URL(req.url).searchParams.get("id")));
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
