import crypto from "node:crypto";
import { cookies } from "next/headers";
import { ownerGate } from "@/lib/auth";
import { authUrl, googleConfigured } from "@/lib/gmailApi";

// Owner: start connecting the café Gmail (opens Google's permission screen)
export async function GET() {
  const gate = await ownerGate();
  if (gate) return gate;
  if (!googleConfigured()) return Response.json({ error: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Railway first (see DEPLOY.md)." }, { status: 400 });
  const state = crypto.randomBytes(16).toString("hex");
  (await cookies()).set("mm_gmail_state", state, { httpOnly: true, sameSite: "lax", path: "/api/admin/gmail", maxAge: 600, secure: !!process.env.SITE_URL?.startsWith("https") });
  return Response.redirect(authUrl(state), 302);
}
