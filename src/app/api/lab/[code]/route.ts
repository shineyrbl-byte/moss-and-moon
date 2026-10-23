import { ownerGate } from "@/lib/auth";
import { getCreation, hideCreation, voteCreation } from "@/lib/lab";
import { limited, tooMany } from "@/lib/rateLimit";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const c = getCreation((await ctx.params).code);
  return c ? Response.json(c) : Response.json({ error: "We couldn't find that drink." }, { status: 404 });
}

// Vote for it ({ voter })
export async function POST(req: Request, ctx: Ctx) {
  if (limited(req, "lab-vote", 60, 3600_000)) return tooMany();
  const b = (await req.json().catch(() => null)) ?? {};
  const r = voteCreation((await ctx.params).code, String(b.voter ?? ""));
  return "error" in r ? Response.json(r, { status: 400 }) : Response.json(r);
}

// Owner: take it down
export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await ownerGate();
  if (gate) return gate;
  return Response.json({ ok: hideCreation((await ctx.params).code) });
}
