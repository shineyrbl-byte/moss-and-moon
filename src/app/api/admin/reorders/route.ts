import { db } from "@/lib/db";
import { isAdmin, ownerGate, unauthorized } from "@/lib/auth";
import { dismissPo, draftPo, listPos, receivePo, sendPo } from "@/lib/reorders";
import { publish } from "@/lib/live";

// Staff: reorders waiting or recently sent
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  return Response.json(listPos());
}

// Owner: start a reorder by hand ({ ingredientId, qty? })
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  const ing = db.prepare("SELECT * FROM ingredients WHERE id = ?").get(String(b?.ingredientId ?? "")) as Parameters<typeof draftPo>[0] | undefined;
  if (!ing) return Response.json({ error: "Unknown ingredient." }, { status: 404 });
  const id = draftPo(ing, Number(b?.qty) > 0 ? Number(b.qty) : undefined);
  if (!id) return Response.json({ error: "There's already an open order for that." }, { status: 409 });
  return Response.json({ ok: true, id });
}

// Owner: send, mark received (staff can do this too), or dismiss ({ id, action, qty? })
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const b = await req.json().catch(() => null);
  const id = Number(b?.id);
  const qty = Number(b?.qty) || undefined;
  if (b?.action !== "receive") {
    const gate = await ownerGate();
    if (gate) return gate;
  }
  const r = b?.action === "send" ? await sendPo(id, qty) : b?.action === "receive" ? receivePo(id, qty) : b?.action === "dismiss" ? dismissPo(id) : { error: "Unknown action." };
  if ("ok" in r) publish({ type: "menu" }); // stock may have changed
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
