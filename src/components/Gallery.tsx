"use client";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { GALLERY } from "@/lib/cafe";
import { photo } from "@/lib/menu";
import Reveal from "./Reveal";
import { useStore } from "./Store";

// Photo sizes vary a bit so the masonry layout looks natural
const HEIGHTS = [420, 300, 360, 280, 380, 300, 340, 400];

type Pic = { img: string; caption: string; guest?: string };

export default function Gallery() {
  const [open, setOpen] = useState<number | null>(null);
  const { t, toast } = useStore();
  // Café photos, then approved guest photos
  const [guests, setGuests] = useState<Pic[]>([]);
  useEffect(() => { fetch("/api/photos").then((r) => r.json()).then((d) => setGuests((d.photos ?? []).map((p: { url: string; caption: string; name: string }) => ({ img: p.url, caption: p.caption, guest: p.name })))).catch(() => {}); }, []);
  const pics: Pic[] = [...GALLERY, ...guests];
  const move = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + pics.length) % pics.length)), [pics.length]);
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function share(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await fetch("/api/photos", { method: "POST", body: new FormData(e.currentTarget) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(d.error ?? "That didn't upload. Try again?");
    setSharing(false);
    toast("Thank you! 📸 It'll appear once we've had a look.");
  }

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
        <p className="eyebrow">{t("moments.eyebrow")}</p>
        <h2>Life at <em>Moss & Moon</em></h2>
      </div>
      <div className="gallery">
        {pics.map((g, i) => (
          <button key={g.img} onClick={() => setOpen(i)} aria-label={`View photo: ${g.caption || `by ${g.guest}`}`}>
            <Image src={photo(g.img, 600)} alt="" width={600} height={HEIGHTS[i % HEIGHTS.length] * 1.5} sizes="(max-width: 600px) 50vw, 300px" style={{ objectFit: "cover", height: HEIGHTS[i % HEIGHTS.length] }} />
            <figcaption>{g.guest ? `📸 ${g.guest}${g.caption ? `: ${g.caption}` : ""}` : g.caption}</figcaption>
          </button>
        ))}
      </div>
      <div className="center" style={{ marginTop: "1.2rem" }}>
        {!sharing ? <button className="btn btn-ghost btn-sm" onClick={() => setSharing(true)}>📸 Share your photo</button> : (
          <form className="card share-photo" onSubmit={share}>
            <label className="field">Your photo<input className="input" type="file" name="file" accept="image/jpeg,image/png,image/webp" required /></label>
            <div className="row">
              <label className="field">Your first name<input className="input" name="name" maxLength={30} required /></label>
              <label className="field">A caption <span className="muted small">· optional</span><input className="input" name="caption" maxLength={120} placeholder="Window seat, rainy Sunday ☔" /></label>
            </div>
            <p className="tiny muted">We&apos;ll have a look before it goes up. Please only share photos you took, and no faces of other people without asking.</p>
            {err && <p className="error small">{err}</p>}
            <span className="row" style={{ gap: "0.5rem", justifyContent: "center" }}>
              <button className="btn btn-pink btn-sm" disabled={busy}>{busy ? "Uploading…" : "Send it"}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSharing(false)}>Cancel</button>
            </span>
          </form>
        )}
      </div>

      {open !== null && (
        <div className="lightbox" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <button className="lb-close" aria-label="Close">✕</button>
          <button className="lb-btn lb-prev" onClick={(e) => { e.stopPropagation(); move(-1); }} aria-label="Previous">‹</button>
          <figure onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo(pics[open].img, 1600)} alt={pics[open].caption || `Photo by ${pics[open].guest}`} />
            <p>{pics[open].guest ? `📸 ${pics[open].guest}${pics[open].caption ? `: ${pics[open].caption}` : ""}` : pics[open].caption}</p>
          </figure>
          <button className="lb-btn lb-next" onClick={(e) => { e.stopPropagation(); move(1); }} aria-label="Next">›</button>
        </div>
      )}
    </Reveal>
  );
}
