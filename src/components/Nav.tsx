"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "./Store";
import ThemeToggle from "./ThemeToggle";
import AmbientSound from "./AmbientSound";

const LINKS = [
  { href: "/#menu", key: "nav.menu" },
  { href: "/#quiz", key: "nav.quiz" },
  { href: "/#events", key: "nav.events" },
  { href: "/#visit", key: "nav.book" },
  { href: "/gift-cards", key: "nav.gift" },
  { href: "/loyalty", key: "nav.stamps" },
] as const;

export default function Nav() {
  const { count, setDrawerOpen, bumpKey, me, t, lang, setLang } = useStore();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  // On phones the language and music buttons move into the ☰ menu so the bar fits
  const [small, setSmall] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 600px)");
    const f = () => setSmall(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);

  const extras = (
    <>
      <button className="icon-btn lang-btn" onClick={() => setLang(lang === "en" ? "hi" : "en")} aria-label={t("lang.label")} title={t("lang.label")}>
        {t("lang.switch")}
      </button>
      <AmbientSound />
    </>
  );

  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 20);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);

  return (
    <header className={`nav ${scrolled ? "scrolled" : ""}`}>
      <Link href="/" className="logo" onClick={() => setOpen(false)}>
        Moss <span>&</span> Moon
      </Link>
      <nav className={`nav-links ${open ? "open" : ""}`} aria-label="Main">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
            {t(l.key)}
          </Link>
        ))}
        {small && <div className="nav-extras"><span className="small muted">Language & music</span>{extras}</div>}
      </nav>
      <div className="nav-tools">
        <Link href="/account" className={`icon-btn ${me ? "on" : ""}`} aria-label={me ? "Your account" : "Sign in"} title={me ? `Signed in as ${me.name || me.email}` : "Sign in"}>
          {me ? (me.name || me.email)[0].toUpperCase() : "👤"}
        </Link>
        {!small && extras}
        <ThemeToggle />
        <button className="cart-btn" onClick={() => setDrawerOpen(true)}>
          <span aria-hidden>🛍</span>
          <span className="cart-label">{t("nav.tray")}</span>
          <span key={bumpKey} className={`badge ${bumpKey ? "bump" : ""}`}>{count}</span>
          <span className="sr-only">items, open tray</span>
        </button>
        <button className="icon-btn burger" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
          {open ? "✕" : "☰"}
        </button>
      </div>
    </header>
  );
}
