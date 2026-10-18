"use client";
import type { MenuItem } from "@/lib/menu";
import type { Options } from "@/lib/pricing";

// A little cup that fills up as you customise: espresso or tea at the bottom,
// milk on top, foam for hot milky drinks, syrup swirls for sweetness, ice for iced.

const MILK: Record<string, string> = { whole: "#f4e9dc", oat: "#ead6b4", almond: "#efdfcb" };

function baseColour(item: MenuItem) {
  const n = item.name.toLowerCase();
  if (n.includes("matcha")) return "#7e9c4f";
  if (n.includes("boba") || n.includes("brown sugar")) return "#9a6438";
  if (n.includes("lime") || n.includes("lemon")) return "#d8b54c";
  if (n.includes("chamomile")) return "#e2c26a";
  if (n.includes("strawberry") || n.includes("rose cloud")) return "#e7a1b4";
  if (n.includes("chai")) return "#b98457";
  if (item.cat === "tea") return "#b07a3e";
  return "#4f3123"; // espresso
}

export default function DrinkCup({ item, opts }: { item: MenuItem; opts: Options }) {
  const iced = opts.temp === "iced";
  const milk = opts.milk && opts.milk !== "none" ? MILK[opts.milk] : null;
  const scale = opts.size === "small" ? 0.82 : opts.size === "large" ? 1.08 : 0.95;
  const sweet = { none: 0, less: 1, normal: 2, extra: 3 }[opts.sweet ?? "normal"] ?? 2;
  const pearls = /boba|pearl/i.test(item.name);

  // Cup interior runs from y=30 (top) to y=130 (bottom): 100 units tall
  const fill = iced ? 88 : 92;
  const foam = !iced && milk ? 12 : 0;
  const base = milk ? 30 + (opts.shot ? 12 : 0) : fill;
  const milkH = milk ? fill - base - foam : 0;
  const top = 130 - fill;

  const layer = (y: number, h: number, colour: string, key: string) => (
    <rect key={key} className="cup-layer" x="10" width="100" style={{ y: `${y}px`, height: `${Math.max(0, h)}px` }} fill={colour} />
  );

  const label = [
    opts.size ?? "regular",
    iced ? "iced" : "hot",
    item.name,
    milk ? `with ${opts.milk} milk` : "",
    opts.shot ? "and an extra shot" : "",
    sweet ? "" : ", unsweetened",
  ].filter(Boolean).join(" ");

  return (
    <div className="drink-cup" role="img" aria-label={`Preview: ${label}`}>
      <svg viewBox="0 0 120 150" style={{ transform: `scale(${scale})` }}>
        <defs>
          <clipPath id="cup-inside">
            <path d="M18 28 L102 28 L92 132 Q91 138 85 138 L35 138 Q29 138 28 132 Z" />
          </clipPath>
        </defs>
        {/* steam */}
        {!iced && (
          <g className="steam" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" opacity="0.5">
            <path d="M45 18 q-5 -6 0 -12" />
            <path d="M60 20 q-5 -7 0 -14" />
            <path d="M75 18 q-5 -6 0 -12" />
          </g>
        )}
        <g clipPath="url(#cup-inside)">
          <rect x="10" y="20" width="100" height="120" fill="var(--surface)" />
          {layer(130 - base, base + 10, baseColour(item), "base")}
          {opts.shot && layer(130 - base, 6, "#2e1a12", "shot")}
          {milk && layer(top + foam, milkH, milk, "milk")}
          {foam > 0 && layer(top, foam + 1, "#fbf5ee", "foam")}
          {/* syrup swirls: one per sweetness level */}
          {Array.from({ length: sweet }, (_, i) => (
            <path key={`s${i}`} className="cup-swirl" d={`M30 ${top + 18 + i * 14} q15 -8 30 0 t30 0`} fill="none" stroke="#c98a3d" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
          ))}
          {pearls && [0, 1, 2, 3, 4, 5].map((i) => <circle key={`p${i}`} cx={38 + i * 9 + (i % 2) * 3} cy={124 - (i % 2) * 6} r="4.5" fill="#2b1a12" />)}
          {iced && [0, 1, 2].map((i) => (
            <rect key={`ice${i}`} className="cup-ice" x={30 + i * 22} y={top + 4 + (i % 2) * 10} width="16" height="16" rx="3" fill="rgba(255,255,255,0.55)" stroke="rgba(255,255,255,0.9)" transform={`rotate(${i * 17 - 12} ${38 + i * 22} ${top + 12})`} />
          ))}
        </g>
        {/* cup outline, handle (hot) or straw (iced) */}
        <path d="M18 28 L102 28 L92 132 Q91 138 85 138 L35 138 Q29 138 28 132 Z" fill="none" stroke="var(--text)" strokeWidth="2.5" strokeLinejoin="round" />
        {iced ? <path d="M70 6 L80 6 L74 70" fill="none" stroke="var(--pink-fill)" strokeWidth="5" strokeLinecap="round" /> : <path d="M100 50 q16 2 14 22 q-2 18 -18 18" fill="none" stroke="var(--text)" strokeWidth="2.5" strokeLinecap="round" />}
      </svg>
    </div>
  );
}
