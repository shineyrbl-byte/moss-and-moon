import { ownerGate } from "@/lib/auth";
import { buildSummary, sendSummary } from "@/lib/summary";

// Owner: preview today's summary
export async function GET() {
  const gate = await ownerGate();
  if (gate) return gate;
  const s = buildSummary();
  return Response.json({ subject: s.subject, html: s.html, data: s.data });
}

// Owner: send today's summary now
export async function POST() {
  const gate = await ownerGate();
  if (gate) return gate;
  if (!(await sendSummary())) return Response.json({ error: "Add your email first." }, { status: 400 });
  return Response.json({ ok: true });
}
