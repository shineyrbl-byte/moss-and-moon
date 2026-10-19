import { tabOfOrder, tabSummary } from "@/lib/tabs";

// The running tab this order is on (anyone with an order code from the table)
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const id = tabOfOrder((await params).code.toUpperCase());
  const t = id ? tabSummary(id) : null;
  if (!t) return Response.json({ error: "This order isn't on a table tab." }, { status: 404 });
  return Response.json(t);
}
