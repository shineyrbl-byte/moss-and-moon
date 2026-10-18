import QRCode from "qrcode";
import { currentStaff } from "@/lib/auth";
import { backupLeft, checkCode, finishSetup, startSetup, turnOff, twoStepOn } from "@/lib/twoStep";

async function owner() {
  const s = await currentStaff();
  return s && s.role === "owner" ? s : null;
}

// Owner: is two-step login on for me?
export async function GET() {
  const me = await owner();
  if (!me) return Response.json({ error: "Owners only." }, { status: 403 });
  return Response.json({ enabled: twoStepOn(me.id), backupLeft: backupLeft(me.id) });
}

// { action: "start" } → QR code to scan · { action: "confirm", code } → on, with backup codes · { action: "off", code }
export async function POST(req: Request) {
  const me = await owner();
  if (!me) return Response.json({ error: "Owners only." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (b.action === "start") {
    if (twoStepOn(me.id)) return Response.json({ error: "It's already on." }, { status: 409 });
    const { secret, url } = startSetup(me.id, me.id === 0 ? "owner" : me.name);
    const qr = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#3b2720", light: "#ffffff" } });
    return Response.json({ secret, qr });
  }
  if (b.action === "confirm") {
    const codes = finishSetup(me.id, String(b.code ?? ""));
    if (!codes) return Response.json({ error: "That code didn't match. Check the time on your phone and try the newest code." }, { status: 400 });
    return Response.json({ ok: true, backupCodes: codes });
  }
  if (b.action === "off") {
    if (!twoStepOn(me.id)) return Response.json({ ok: true });
    if (checkCode(me.id, String(b.code ?? "")) !== "ok") return Response.json({ error: "Enter a current code (or a backup code) to turn it off." }, { status: 400 });
    turnOff(me.id);
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Unknown action." }, { status: 400 });
}
