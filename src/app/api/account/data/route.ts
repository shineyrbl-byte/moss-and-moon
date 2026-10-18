import { currentCustomer, endSession } from "@/lib/account";
import { deleteAccount, exportData } from "@/lib/dataRights";
import { limited, tooMany } from "@/lib/rateLimit";

const signIn = () => Response.json({ error: "Please sign in first." }, { status: 401 });

// Download everything we hold about you
export async function GET(req: Request) {
  if (limited(req, "data-export", 10, 3600_000)) return tooMany();
  const me = await currentCustomer();
  if (!me) return signIn();
  return new Response(JSON.stringify(exportData(me), null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="moss-and-moon-my-data.json"', "Cache-Control": "no-store" },
  });
}

// Delete your account ({ confirm: "DELETE" })
export async function DELETE(req: Request) {
  if (limited(req, "data-delete", 5, 3600_000)) return tooMany();
  const me = await currentCustomer();
  if (!me) return signIn();
  const b = await req.json().catch(() => null);
  if (b?.confirm !== "DELETE") return Response.json({ error: "Type DELETE to confirm." }, { status: 400 });
  deleteAccount(me);
  await endSession();
  return Response.json({ ok: true });
}
