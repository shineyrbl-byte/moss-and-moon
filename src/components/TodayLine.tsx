"use client";
import { useEffect, useState } from "react";
import { useStore } from "./Store";
import { fill } from "@/lib/i18n";
import { itemName } from "@/lib/menu";

type T = { cups: number; orders: number; top: { id: string; name: string; qty: number } | null };

/** "☕ 132 cups poured today · most loved: Iced Brown Sugar Shaken" (hidden until the first cup) */
export default function TodayLine({ big = false }: { big?: boolean }) {
  const { t, lang, find } = useStore();
  const [d, setD] = useState<T | null>(null);
  useEffect(() => {
    const load = () => fetch("/api/today").then((r) => r.json()).then(setD).catch(() => {});
    load();
    const id = setInterval(load, 90_000);
    return () => clearInterval(id);
  }, []);
  if (!d || !d.cups) return null;
  const top = d.top ? find(d.top.id) : undefined;
  return (
    <p className={`today-line ${big ? "big" : ""}`} aria-live="polite">
      ☕ {fill(t(d.cups === 1 ? "today.cup" : "today.cups"), { n: d.cups })}
      {d.top && <> · {fill(t("today.top"), { name: top ? itemName(top, lang) : d.top.name })}</>}
    </p>
  );
}
