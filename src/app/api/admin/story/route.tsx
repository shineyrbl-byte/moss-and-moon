import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { currentStaff, unauthorized } from "@/lib/auth";
import { menuLookup } from "@/lib/menuStore";
import { findEvent } from "@/lib/eventsStore";
import { photo } from "@/lib/menu";
import { rupees } from "@/lib/pricing";
import { dataDir } from "@/lib/db";

// Staff: a 1080×1920 Instagram story image for a menu item (?item=) or an event (?event=)
export async function GET(req: Request) {
  if (!(await currentStaff())) return unauthorized();
  const q = new URL(req.url).searchParams;
  const item = q.get("item") ? menuLookup()(q.get("item")!) : undefined;
  const ev = q.get("event") ? findEvent(q.get("event")!) : undefined;
  if (!item && !ev) return Response.json({ error: "Pick a menu item or an event." }, { status: 404 });

  const img = item?.img ?? ev!.img;
  const eyebrow = item ? (item.id.startsWith("special-") ? "today's special" : "on the menu") : ev!.price ? "tickets now on sale" : "free · save your spot";
  const title = item?.name ?? ev!.title;
  const sub = item ? item.desc : `${new Date(`${ev!.date}T${ev!.time}`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · ${new Date(`${ev!.date}T${ev!.time}`).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;
  const price = item ? rupees(item.price) : ev!.price ? rupees(ev!.price) : "Free";

  // The photo, as a data URL (a slow or missing photo just leaves the pink background)
  let src: string | null = null;
  try {
    if (img.startsWith("/api/uploads/")) {
      const file = path.join(dataDir(), "uploads", path.basename(img));
      src = `data:image/${img.endsWith(".png") ? "png" : img.endsWith(".webp") ? "webp" : "jpeg"};base64,${(await readFile(file)).toString("base64")}`;
    } else {
      const r = await fetch(photo(img, 1080), { signal: AbortSignal.timeout(4000) });
      if (r.ok) src = `data:${r.headers.get("content-type") ?? "image/jpeg"};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
    }
  } catch {}

  const site = (process.env.SITE_URL || "").replace(/^https?:\/\//, "");
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f6eee7", fontFamily: "Georgia, serif", color: "#3b2720" }}>
        <div style={{ height: 1060, display: "flex", position: "relative", background: "#f9dce3", overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src && <img src={src} alt="" width={1080} height={1060} style={{ objectFit: "cover", width: 1080, height: 1060 }} />}
          <div style={{ position: "absolute", top: 70, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
            <div style={{ display: "flex", background: "rgba(255,250,246,0.92)", borderRadius: 999, padding: "18px 44px", fontSize: 54 }}>
              Moss <span style={{ color: "#c25b78", fontStyle: "italic", margin: "0 14px" }}>&amp;</span> Moon
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: "70px 80px 0", flex: 1 }}>
          <div style={{ fontSize: 34, letterSpacing: 8, textTransform: "uppercase", color: "#b97f52", fontFamily: "Helvetica" }}>{eyebrow}</div>
          <div style={{ fontSize: title.length > 22 ? 96 : 120, lineHeight: 1.02, marginTop: 24 }}>{title}</div>
          <div style={{ fontSize: 44, color: "#765749", marginTop: 30, lineHeight: 1.3, fontFamily: "Helvetica" }}>{sub.slice(0, 120)}</div>
          <div style={{ display: "flex", marginTop: "auto", marginBottom: 90, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", background: "#b8506e", color: "#fff", borderRadius: 999, padding: "20px 48px", fontSize: 58, fontFamily: "Helvetica", fontWeight: 700 }}>{price}</div>
            <div style={{ display: "flex", fontSize: 36, color: "#765749", fontFamily: "Helvetica" }}>{site || "order ahead online"}</div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920, headers: { "Content-Disposition": `inline; filename="moss-moon-${(item?.id ?? ev!.id).slice(0, 40)}.png"`, "Cache-Control": "no-store" } },
  );
}
