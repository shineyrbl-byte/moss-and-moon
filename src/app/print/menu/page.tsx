import "./page.css";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { getMenu } from "@/lib/menuStore";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/menu";
import { happyHourLabel, rupees } from "@/lib/pricing";
import { hoursLabel, findBranch } from "@/lib/cafe";
import PrintButton from "./PrintButton";

export const metadata: Metadata = { title: "Printable menu", robots: { index: false } };
export const dynamic = "force-dynamic";

// The live menu as a printable A4 page (or a counter poster with ?poster=1)
export default async function MenuCard({ searchParams }: { searchParams: Promise<{ poster?: string }> }) {
  const poster = (await searchParams).poster === "1";
  const site = process.env.SITE_URL || "http://localhost:3000";
  const qr = await QRCode.toString(`${site}/#menu`, { type: "svg", margin: 1, color: { dark: "#3b2720", light: "#ffffff" } });
  const menu = getMenu().filter((m) => m.cat !== "shop" && !m.id.startsWith("special-"));
  const sections = CATEGORY_ORDER.filter((c) => c !== "shop").map((c) => ({ id: c, label: CATEGORIES.find((x) => x.id === c)?.label ?? c, items: menu.filter((m) => m.cat === c) })).filter((s) => s.items.length);
  const main = findBranch("main");

  return (
    <div className={`menu-card ${poster ? "poster" : ""}`}>
      <PrintButton />
      <header className="mc-head">
        <h1>Moss <em>&amp;</em> Moon</h1>
        <p>{main.address} · {hoursLabel().map((h) => `${h.days} ${h.time}`).join(" · ")}</p>
      </header>
      <div className="mc-cols">
        {sections.map((s) => (
          <section key={s.id} className="mc-section">
            <h2>{s.label}</h2>
            <ul>
              {s.items.map((m) => (
                <li key={m.id}>
                  <div className="mc-line"><b>{m.name}</b><span className="mc-dots" /><span>{rupees(m.price)}</span></div>
                  {!poster && <p>{m.desc}{m.diet?.includes("vegan") ? " 🌱" : ""}{m.diet?.includes("gf") ? " · GF" : ""}</p>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <footer className="mc-foot">
        <div>
          <p>✨ {happyHourLabel()}</p>
          <p>Oat, almond or soy milk on any drink · ask us about allergens · 🌱 vegan · GF gluten-free</p>
        </div>
        <div className="mc-qr">
          <span dangerouslySetInnerHTML={{ __html: qr }} />
          <small>Scan to order ahead</small>
        </div>
      </footer>
    </div>
  );
}
