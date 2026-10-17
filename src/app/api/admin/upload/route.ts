import { ownerGate } from "@/lib/auth";
import { savePhoto } from "@/lib/uploads";

// Owner: upload a menu photo. Saved next to the database (on the persistent disk).
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const form = await req.formData().catch(() => null);
  const r = await savePhoto(form?.get("file"), 5);
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
