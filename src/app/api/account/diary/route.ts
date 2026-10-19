import { currentCustomer } from "@/lib/account";
import { addDiaryEntry, deleteDiaryEntry, diaryEntries, tasteProfile, toRate } from "@/lib/diary";
import { limited, tooMany } from "@/lib/rateLimit";

const signIn = () => Response.json({ error: "Please sign in to keep a coffee diary." }, { status: 401 });

// Your diary, your taste profile and drinks from recent orders waiting for a rating
export async function GET() {
  const me = await currentCustomer();
  if (!me) return signIn();
  const entries = diaryEntries(me.id);
  return Response.json({ entries, profile: tasteProfile(entries), toRate: toRate(me.id) });
}

// Add an entry ({ itemId, orderCode? } for one of ours, or { name, place } for anywhere else; rating, note)
export async function POST(req: Request) {
  if (limited(req, "diary", 60, 3600_000)) return tooMany();
  const me = await currentCustomer();
  if (!me) return signIn();
  const r = addDiaryEntry(me.id, (await req.json().catch(() => null)) ?? {});
  if ("error" in r) return Response.json(r, { status: 400 });
  return Response.json({ ok: true, entry: r });
}

// Remove an entry (?id=)
export async function DELETE(req: Request) {
  const me = await currentCustomer();
  if (!me) return signIn();
  const ok = deleteDiaryEntry(me.id, Number(new URL(req.url).searchParams.get("id")));
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
