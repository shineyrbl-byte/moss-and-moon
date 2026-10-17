"use client";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { GALLERY } from "@/lib/cafe";
import { photo } from "@/lib/menu";
import Reveal from "./Reveal";

// Photo sizes vary a bit so the masonry layout looks natural
const HEIGHTS = [420, 300, 360, 280, 380, 300, 340, 400];

export default function Gallery() {
  const [open, setOpen] = useState<number | null>(null);
  const move = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + GALLERY.length) % GALLERY.length)), []);

  useEffect(() => {
    if (open === null) return;
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [open, move]);

  return (
    <Reveal id="moments" className="section">
      <div className="center">
        <p className="eyebrow">moments</p>
        <h2>Life at <em>Moss & Moon</em></h2>
      </div>
      <div className="gallery">
        {GALLERY.map((g, i) => (
          <button key={g.img} onClick={() => setOpen(i)} aria-label={`View photo: ${g.caption}`}>
            <Image src={photo(g.img, 600)} alt={g.caption} width={600} height={HEIGHTS[i % HEIGHTS.length] * 1.5} sizes="(max-width: 600px) 50vw, 300px" style={{ objectFit: "cover", height: HEIGHTS[i % HEIGHTS.length] }} />
            <figcaption>{g.caption}</figcaption>
          </button>
        ))}
      </div>

      {open !== null && (
        <div className="lightbox" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <button className="lb-close" aria-label="Close">✕</button>
          <button className="lb-btn lb-prev" onClick={(e) => { e.stopPropagation(); move(-1); }} aria-label="Previous">‹</button>
          <figure onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo(GALLERY[open].img, 1600)} alt={GALLERY[open].caption} />
            <p>{GALLERY[open].caption}</p>
          </figure>
          <button className="lb-btn lb-next" onClick={(e) => { e.stopPropagation(); move(1); }} aria-label="Next">›</button>
        </div>
      )}
    </Reveal>
  );
}
