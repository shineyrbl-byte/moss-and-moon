"use client";
import Link from "next/link";
import { hoursLabel, whatsappUrl } from "@/lib/cafe";
import InstallButton from "./InstallButton";
import { useStore } from "./Store";

export default function Footer() {
  const { t } = useStore();
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <p className="logo">Moss <span>&</span> Moon</p>
          <p className="muted small" style={{ maxWidth: "22rem", marginTop: "0.6rem" }}>
            A slow-coffee corner with pink lattes, warm bakes and a sunny window seat. Made with oat milk & love.
          </p>
        </div>
        <div>
          <h2>{t("footer.explore")}</h2>
          <ul>
            <li><Link href="/#menu">{t("nav.menu")}</Link></li>
            <li><Link href="/#events">{t("nav.events")}</Link></li>
            <li><Link href="/#reviews">{t("footer.reviews")}</Link></li>
            <li><Link href="/loyalty">{t("nav.stamps")}</Link></li>
            <li><Link href="/gift-cards">{t("nav.gift")}</Link></li>
            <li><Link href="/gift-a-drink">{t("footer.giftDrink")}</Link></li>
            <li><Link href="/noticeboard">{t("footer.noticeboard")}</Link></li>
            <li><Link href="/journal">{t("footer.journal")}</Link></li>
            <li><Link href="/recipes">{t("footer.recipes")}</Link></li>
            <li><Link href="/diary">{t("footer.diary")}</Link></li>
            <li><Link href="/brew">{t("footer.brew")}</Link></li>
            <li><Link href="/origins">{t("footer.origins")}</Link></li>
            <li><Link href="/passport">{t("footer.passport")}</Link></li>
            <li><Link href="/lab">{t("footer.lab")}</Link></li>
            <li><Link href="/shelf">{t("footer.shelf")}</Link></li>
            <li><Link href="/play">{t("footer.play")}</Link></li>
            <li><Link href="/catering">{t("footer.catering")}</Link></li>
            <li><Link href="/cakes">{t("footer.cakes")}</Link></li>
            {whatsappUrl() && <li><a href={whatsappUrl()!} target="_blank" rel="noopener noreferrer">{t("footer.whatsapp")}</a></li>}
            <li><Link href="/privacy">{t("footer.privacy")}</Link> · <Link href="/terms">{t("footer.terms")}</Link></li>
            <li><Link href="/orders">{t("footer.orders")}</Link></li>
          </ul>
        </div>
        <div>
          <h2>{t("footer.hours")}</h2>
          <ul>
            {hoursLabel().map((h) => (
              <li key={h.days}>{h.days} · {h.time}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2>{t("footer.hi")}</h2>
          <ul>
            <li>14 Willow Lane</li>
            <li>hello@mossandmoon.cafe</li>
            <li><Link href="/admin">{t("footer.staff")}</Link></li>
          </ul>
          <div style={{ marginTop: "1rem" }}><InstallButton className="btn btn-pink btn-sm" /></div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Moss & Moon</span>
        <span>{t("footer.photos")}</span>
      </div>
    </footer>
  );
}
