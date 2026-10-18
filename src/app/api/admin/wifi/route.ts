import { ownerGate } from "@/lib/auth";
import { saveWifi, wifiSettings } from "@/lib/wifi";

export async function GET() {
  const gate = await ownerGate();
  if (gate) return gate;
  return Response.json(wifiSettings());
}

export async function PUT(req: Request) {
  const gate = await ownerGate();
  if (gate) return gate;
  const r = saveWifi((await req.json().catch(() => ({}))) ?? {});
  return Response.json(r, { status: "error" in r ? 400 : 200 });
}
