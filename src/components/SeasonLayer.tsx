"use client";
import { useEffect, useState } from "react";
import { SEASONS, type SeasonId } from "@/lib/seasons";
import { useStore } from "./Store";

const COUNT = { diya: 12, rain: 40, snow: 30, heart: 14 } as const;

/**
 * Festival banner + a light sprinkle of falling or floating decorations.
 * Add ?season=diwali (or monsoon / christmas / valentines / off) to any page to preview one.
 */
export default function SeasonLayer({ season: fromServer }: { season: SeasonId | null }) {
  const { find, setCustomizing } = useStore();
  const [season, setSeason] = useState<SeasonId | null>(fromServer);
  const [hideBanner, setHideBanner] = useState(true);
  const [dots, setDots] = useState<{ left: number; delay: number; dur: number; size: number }[]>([]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("season");
    const s = q === "off" ? null : q && q in SEASONS ? (q as SeasonId) : fromServer;
    setSeason(s);
    if (s) document.documentElement.dataset.season = s;
    else delete document.documentElement.dataset.season;
    try { setHideBanner(sessionStorage.getItem(`mm-season-${s}`) === "hidden"); } catch { setHideBanner(false); }
  }, [fromServer]);

  // Random positions are made in the browser only, so server and browser HTML match
  useEffect(() => {
    if (!season) return setDots([]);
    const n = COUNT[SEASONS[season].particle];
    setDots(Array.from({ length: n }, () => ({ left: Math.random() * 100, delay: -Math.random() * 20, dur: 0.7 + Math.random() * 0.6, size: 0.7 + Math.random() * 0.6 })));
  }, [season]);

  if (!season) return null;
  const s = SEASONS[season];
  const drink = find(s.drink);

  return (
    <>
      {!hideBanner && (
        <div className="season-banner" role="note">
          <span>{s.banner}</span>
          {drink && !drink.soldOut && (
            <button className="season-cta" onClick={() => setCustomizing(drink)}>Try it</button>
          )}
          <button
            className="season-x"
            aria-label="Hide this message"
            onClick={() => {
              setHideBanner(true);
              try { sessionStorage.setItem(`mm-season-${season}`, "hidden"); } catch {}
            }}
          >
            ✕
          </button>
        </div>
      )}
      <div className={`season-sky sky-${s.particle}`} aria-hidden>
        {dots.map((d, i) => (
          <span
            key={i}
            style={{ left: `${d.left}%`, animationDelay: `${d.delay}s`, animationDuration: `calc(var(--sky-speed) * ${d.dur})`, fontSize: `calc(var(--sky-size) * ${d.size})` }}
          />
        ))}
      </div>
    </>
  );
}
