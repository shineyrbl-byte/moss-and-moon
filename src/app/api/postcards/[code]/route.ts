import { getPostcard } from "@/lib/postcards";

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const p = getPostcard((await ctx.params).code);
  return p ? Response.json(p) : Response.json({ error: "We couldn't find that postcard." }, { status: 404 });
}
