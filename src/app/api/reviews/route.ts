import { db, cleanText } from "@/lib/db";
import { alertOwner } from "@/lib/push";
import { isOurPhoto } from "@/lib/uploads";
import { ownerEmail } from "@/lib/owner";
import { sendLater } from "@/lib/email";
import { limited, tooMany } from "@/lib/rateLimit";
import { isAdmin } from "@/lib/auth";

// Public wall: private feedback (unhappy visit reviews) is left out. Staff see everything.
export async function GET() {
  const staff = await isAdmin();
  const where = staff ? "" : "WHERE private = 0";
  const rows = db.prepare(`SELECT id, name, rating, text, photo, created_at, order_code IS NOT NULL AS verified, private FROM reviews ${where} ORDER BY id DESC LIMIT ${staff ? 60 : 30}`).all();
  const s = db.prepare(`SELECT COUNT(*) AS count, ROUND(AVG(rating), 1) AS avg FROM reviews ${where}`).get();
  return Response.json({ reviews: rows, ...s });
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function POST(req: Request) {
  if (limited(req, "reviews", 15, 600000)) return tooMany();
  const b = await req.json().catch(() => null);
  const name = cleanText(b?.name, 40);
  const text = cleanText(b?.text, 400);
  const rating = Math.floor(Number(b?.rating));
  if (!name || text.length < 5) return Response.json({ error: "Please add your name and a few words." }, { status: 400 });
  if (!(rating >= 1 && rating <= 5)) return Response.json({ error: "Please choose a star rating." }, { status: 400 });
  const photo = b?.photo && isOurPhoto(b.photo) ? String(b.photo) : null;
  if (b?.photo && !photo) return Response.json({ error: "That photo didn't upload properly. Try again?" }, { status: 400 });

  // From a "How was it?" email: tied to a real order, once per order
  let orderCode: string | null = null;
  if (b?.orderCode) {
    orderCode = String(b.orderCode).toUpperCase();
    if (!db.prepare("SELECT 1 FROM orders WHERE code = ?").get(orderCode)) return Response.json({ error: "We couldn't find that order." }, { status: 404 });
    if (db.prepare("SELECT 1 FROM reviews WHERE order_code = ?").get(orderCode)) return Response.json({ error: "You've already reviewed this visit. Thank you ✿" }, { status: 409 });
  }
  // A so-so or unhappy visit goes privately to the owner instead of the public wall
  const isPrivate = orderCode && rating <= 3 ? 1 : 0;
  db.prepare("INSERT INTO reviews (name, rating, text, photo, order_code, private) VALUES (?, ?, ?, ?, ?, ?)").run(name, rating, text, photo, orderCode, isPrivate);

  // A heads-up for the owner when someone wasn't happy, so they can make it right
  if (rating <= 2) alertOwner("review", `${rating}★ review from ${name}`, text.slice(0, 120), "/admin#Reviews");
  if (rating <= 2 && ownerEmail())
    sendLater(ownerEmail(), `A guest gave ${rating} star${rating === 1 ? "" : "s"} 😟`, `<p><b>${esc(name)}</b>${orderCode ? ` (order ${esc(orderCode)})` : ""} wrote:</p><p style="font-style:italic">“${esc(text)}”</p><p style="color:#8a6a5c;font-size:13px">You can reply in person, or remove the review in Admin → Reviews if it's not genuine.</p>`);
  return Response.json({ ok: true, private: !!isPrivate });
}
