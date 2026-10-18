import crypto from "node:crypto";
import { db } from "@/lib/db";
import { getMenu } from "@/lib/menuStore";
import { isDrink } from "@/lib/pricing";
import { toDateStr } from "@/lib/cafe";
import { limited, tooMany } from "@/lib/rateLimit";
import { clientIp } from "@/lib/site";

const WIN_CHANCE = 0.25;
const WIN_OFF = 10; // % off, today only, one use

// "Surprise me": the wheel picks a drink, and sometimes a little discount code
export async function POST(req: Request) {
  if (limited(req, "surprise", 8, 600_000)) return tooMany("The wheel needs a rest ☕ Try again in a few minutes.");
  const drinks = getMenu().filter((m) => isDrink(m.cat) && !m.soldOut);
  if (!drinks.length) return Response.json({ error: "Everything's sold out right now!" }, { status: 409 });
  // The wheel shows 8 drinks; the server picks which one it lands on
  const wheel = [...drinks].sort(() => Math.random() - 0.5).slice(0, 8);
  const index = crypto.randomInt(wheel.length);

  // At most one discount a day per visitor
  const today = toDateStr(new Date());
  const who = crypto.createHash("sha256").update(`spin|${today}|${clientIp(req)}`).digest("hex").slice(0, 16);
  const already = db.prepare("SELECT 1 FROM promos WHERE note = ?").get(`Surprise wheel ${who}`);
  let code: string | null = null;
  if (!already && Math.random() < WIN_CHANCE) {
    code = `SPIN${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    db.prepare("INSERT INTO promos (code, kind, value, min_order, max_uses, once_per_guest, starts, expires, note) VALUES (?, 'percent', ?, 0, 1, 1, ?, ?, ?)").run(code, WIN_OFF, today, today, `Surprise wheel ${who}`);
  }
  return Response.json({ wheel: wheel.map((m) => ({ id: m.id, name: m.name, img: m.img })), index, code, off: code ? WIN_OFF : 0 });
}
