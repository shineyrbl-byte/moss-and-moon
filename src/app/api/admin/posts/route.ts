import { ownerGate } from "@/lib/auth";
import { allPosts, deletePost, savePost } from "@/lib/posts";

export async function GET() {
  const gate = await ownerGate();
  if (gate) return gate;
  return Response.json(allPosts());
}

// Owner: create or update a post ({ slug?, title, body, cover, status })
export async function POST(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const r = savePost((await req.json().catch(() => ({}))) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}

export async function DELETE(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const b = await req.json().catch(() => null);
  deletePost(String(b?.slug ?? ""));
  return Response.json({ ok: true });
}
