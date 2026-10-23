"use client";
import Link from "next/link";
import { useState } from "react";

export const DESIGN_INFO = {
  rose: { label: "Rose garden", art: "🌸", line: "Sending you something sweet" },
  moon: { label: "Moonlit café", art: "☾", line: "Thinking of you tonight" },
  monsoon: { label: "Monsoon", art: "☔", line: "Rainy day, warm cup, you" },
  sunny: { label: "Sunny Goa", art: "☀️", line: "Wish you were here" },
} as const;
export type Design = keyof typeof DESIGN_INFO;
type Card = { design: Design; from: string; to: string; message: string; gift?: { code: string; item: string; claimed: boolean } | null };

/** The postcard: a picture side and a message side; tap to flip */
export default function Postcard({ c, startFlipped = false }: { c: Card; startFlipped?: boolean }) {
  const [back, setBack] = useState(startFlipped);
  const d = DESIGN_INFO[c.design] ?? DESIGN_INFO.rose;
  return (
    <div className={`postcard pc-${c.design} ${back ? "flipped" : ""}`}>
      <button className="pc-inner" onClick={() => setBack((b) => !b)} aria-label={back ? "Turn to the picture" : "Turn over to read the message"}>
        <div className="pc-face pc-front" aria-hidden={back}>
          <span className="pc-art">{d.art}</span>
          <span className="pc-line">{d.line}</span>
          <span className="pc-brand">Moss <em>&amp;</em> Moon · Panjim</span>
          <span className="pc-hint tiny">tap to turn over ↻</span>
        </div>
        <div className="pc-face pc-back" aria-hidden={!back}>
          <span className="pc-to">Dear {c.to},</span>
          <span className="pc-msg">{c.message}</span>
          <span className="pc-from">with love, {c.from}</span>
          <span className="pc-stamp" aria-hidden>☕</span>
        </div>
      </button>
      {c.gift && (
        <p className="reward-banner small" style={{ marginTop: "0.8rem", textAlign: "center" }}>
          🎁 {c.from} also bought you a <b>{c.gift.item}</b>.{" "}
          {c.gift.claimed ? <span className="muted">(already claimed)</span> : <Link href={`/d/${c.gift.code}`} className="link-btn">Claim it →</Link>}
        </p>
      )}
    </div>
  );
}
