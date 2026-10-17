"use client";
import { useEffect, useState } from "react";

// Switches between the pink day café and the moonlit night café.
export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("mm-theme", next); } catch {}
    setTheme(next);
  };

  return (
    <button className="icon-btn" onClick={flip} aria-label={theme === "dark" ? "Switch to day mode" : "Switch to night café mode"} title={theme === "dark" ? "Day mode" : "Night café"}>
      {theme === "dark" ? "☀︎" : "☾"}
    </button>
  );
}
