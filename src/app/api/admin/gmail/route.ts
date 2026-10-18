import { ownerGate } from "@/lib/auth";
import { connectedAddress, disconnect, googleConfigured, redirectUri } from "@/lib/gmailApi";
import { emailProvider } from "@/lib/email";

// Owner: is the café Gmail connected?
export async function GET() {
  const gate = await ownerGate();
  if (gate) return gate;
  return Response.json({ configured: googleConfigured(), address: connectedAddress(), provider: emailProvider(), redirectUri: redirectUri() });
}

// Owner: disconnect it
export async function DELETE() {
  const gate = await ownerGate();
  if (gate) return gate;
  disconnect();
  return Response.json({ ok: true });
}
