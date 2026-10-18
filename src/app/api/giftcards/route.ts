import { db, makeCode, cleanText, cleanEmail } from "@/lib/db";
import { ownerGate } from "@/lib/auth";
import { limited, tooMany } from "@/lib/rateLimit";

const GIFT_DESIGNS = ["blush", "mocha", "matcha"];

// Create a gift card (it becomes usable once it's paid for)
export async function POST(req: Request) {
  if (limited(req, "giftcards", 20, 600000)) return tooMany();
  const b = await req.json().catch(() => null);
  const amount = Math.floor(Number(b?.amount));
  const fromName = cleanText(b?.fromName, 40);
  const toName = cleanText(b?.toName, 40);
  const toEmail = cleanEmail(b?.toEmail);
  const message = cleanText(b?.message, 200);
  const design = GIFT_DESIGNS.includes(b?.design) ? b.design : "blush";

  if (!(amount >= 200 && amount <= 10000)) return Response.json({ error: "Gift cards can be ₹200 to ₹10,000." }, { status: 400 });
  if (!fromName || !toName) return Response.json({ error: "Please add both names." }, { status: 400 });
  if (!toEmail) return Response.json({ error: "Please add the recipient's email — that's where we send the card." }, { status: 400 });

  const code = makeCode("GIFT", 8);
  db.prepare("INSERT INTO giftcards (code, amount, balance, from_name, to_name, to_email, message, design) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
    code, amount, amount, fromName, toName, toEmail, message || null, design
  );
  return Response.json({ code });
}

// Staff: all gift cards
export async function GET() {
  {
    const gate = await ownerGate();
    if (gate) return gate;
  }
  return Response.json(db.prepare("SELECT * FROM giftcards ORDER BY id DESC LIMIT 200").all());
}
