"use client";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import { CATEGORIES, photo, type MenuItem } from "@/lib/menu";
import { happyHourLabel, isHappyHour, rupees } from "@/lib/pricing";
import { isLastHour, lastHourLabel, hoursLabel } from "@/lib/cafe";
import type { CafeEvent } from "@/lib/cafe";

const SLIDE_MS = 12_000;
type Slide = { kind: "section"; label: string; items: MenuItem[] } | { kind: "special"; item: MenuItem } | { kind: "events"; events: CafeEvent[] } | { kind: "deal"; text: string };

// Menu screen for the café TV: open /board/menu and go full screen. It cycles by itself.
export default function MenuBoard() {
  const { menu: initial } = useStore();
  const [menu, setMenu] = useState<MenuItem[]>(initial);
  const [events, setEvents] = useState<CafeEvent[]>([]);
  const [i, setI] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const load = useCallback(() => {
    fetch("/api/menu").then((r) => r.json()).then((d) => setMenu(d.items)).catch(() => {});
    fetch("/api/events").then((r) => r.json()).then((d) => setEvents((d as CafeEvent[]).slice(0, 3))).catch(() => {});
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 5 * 60_000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => { setI((x) => x + 1); setNow(new Date()); }, SLIDE_MS); return () => clearInterval(t); }, []);

  const slides = useMemo<Slide[]>(() => {
    const out: Slide[] = [];
    const visible = menu.filter((m) => m.cat !== "shop" && !m.soldOut);
    for (const sp of visible.filter((m) => m.id.startsWith("special-"))) out.push({ kind: "special", item: sp });
    for (const c of CATEGORIES.filter((c) => !["all", "specials", "shop", "kids"].includes(c.id))) {
      const items = visible.filter((m) => m.cat === c.id && !m.id.startsWith("special-"));
      // Long sections are split over two screens
      for (let k = 0; k < items.length; k += 8) out.push({ kind: "section", label: c.label, items: items.slice(k, k + 8) });
    }
    if (isLastHour(now)) out.push({ kind: "deal", text: `🌙 ${lastHourLabel()}` });
    else out.push({ kind: "deal", text: `${isHappyHour(now) ? "✨ It's golden hour! " : "✨ "}${happyHourLabel()}` });
    if (events.length) out.push({ kind: "events", events });
    return out;
  }, [menu, events, now]);
  const s = slides.length ? slides[i % slides.length] : null;
  const today = hoursLabel().find((h) => [h.from, h.to].includes(now.getDay()))?.time;

  return (
    <div className="mboard" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>
      <header className="mboard-head">
        <span className="logo">Moss <em>&amp;</em> Moon</span>
        <span>{now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}{today ? ` · today ${today}` : ""}</span>
      </header>
      {s && (
        <main key={i} className="mboard-slide">
          {s.kind === "section" && (
            <>
              <h1>{s.label}</h1>
              <ul className="mboard-list">
                {s.items.map((m) => (
                  <li key={m.id}><span>{m.name}{m.badge === "bestseller" ? " ★" : ""}{m.loved && m.loved >= 80 ? " ❤" : ""}</span><span className="mboard-dots" /><b>{rupees(m.price)}</b></li>
                ))}
              </ul>
            </>
          )}
          {s.kind === "special" && (
            <div className="mboard-special">
              <div className="mboard-photo"><Image src={photo(s.item.img, 1200)} alt="" fill sizes="50vw" /></div>
              <div><p className="mboard-eyebrow">today&apos;s special</p><h1>{s.item.name}</h1><p>{s.item.desc}</p><b className="mboard-price">{rupees(s.item.price)}</b></div>
            </div>
          )}
          {s.kind === "deal" && <div className="mboard-deal"><h1>{s.text}</h1></div>}
          {s.kind === "events" && (
            <>
              <h1>Coming up</h1>
              <ul className="mboard-list">
                {s.events.map((e) => <li key={e.id}><span>{e.title}</span><span className="mboard-dots" /><b>{new Date(`${e.date}T${e.time}`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</b></li>)}
              </ul>
              <p className="mboard-eyebrow">ask at the counter or book online</p>
            </>
          )}
        </main>
      )}
      <footer className="mboard-foot">
        <span>Order ahead or from your table: scan the QR on your table ☕</span>
        <span className="mboard-dotsrow">{slides.map((_, k) => <i key={k} className={k === i % slides.length ? "on" : ""} />)}</span>
      </footer>
    </div>
  );
}
