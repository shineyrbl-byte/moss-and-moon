"use client";
import { useState } from "react";
import { cafeLinks } from "@/lib/cafe";

/** After a happy review: "post it on Google too" (copies their words, then opens Google) */
export default function GoogleNudge({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const url = cafeLinks().googleReview;
  if (!url) return null;
  return (
    <div className="reward-banner" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "center", marginTop: "1rem" }}>
      <span>Would you share it on Google too? It really helps a small café 🌸</span>
      <a className="btn btn-pink btn-sm" href={url} target="_blank" rel="noopener noreferrer" onClick={() => { try { navigator.clipboard?.writeText(text); setCopied(true); } catch {} }}>⭐ Post on Google</a>
      {copied && text && <small className="muted">Your review is copied. Just paste it in.</small>}
    </div>
  );
}
