"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "./Store";
import ThemeToggle from "./ThemeToggle";
import AmbientSound from "./AmbientSound";

const LINKS = [
  { href: "/#menu", label: "Menu" },
  { href: "/#quiz", label: "Find your drink" },
  { href: "/#events", label: "Events" },
  { href: "/#visit", label: "Book a table" },
  { href: "/gift-cards", label: "Gift cards" },
  { href: "/loyalty", label: "Stamp card" },
];

export default function Nav() {
  const { count, setDrawerOpen, bumpKey } = useStore();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

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
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="nav-tools">
        <AmbientSound />
        <ThemeToggle />
        <button className="cart-btn" onClick={() => setDrawerOpen(true)} aria-label={`Open your tray, ${count} items`}>
          <span aria-hidden>🛍</span>
          <span className="cart-label">Tray</span>
          <span key={bumpKey} className={`badge ${bumpKey ? "bump" : ""}`}>{count}</span>
        </button>
        <button className="icon-btn burger" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
          {open ? "✕" : "☰"}
        </button>
      </div>
    </header>
  );
}
