"use client";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "./Store";
import Reveal from "./Reveal";

type Review = { id: number; name: string; rating: number; text: string; photo: string | null; created_at: string };

const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

export default function Reviews() {
  const { toast, t } = useStore();
  const [data, setData] = useState<{ reviews: Review[]; avg: number | null; count: number } | null>(null);
  const [writing, setWriting] = useState(false);
  const [form, setForm] = useState({ name: "", text: "", rating: 0, photo: "" });
  const [uploading, setUploading] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [hover, setHover] = useState(0);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(() => {
    fetch("/api/reviews").then((r) => r.json()).then(setData).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const r = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await r.json();
    if (!r.ok) return setError(d.error);
    setForm({ name: "", text: "", rating: 0, photo: "" });
    setWriting(false);
    toast("Thank you for the kind words 🌸");
    load();
  }

  async function addPhoto(file: File) {
    setUploading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/reviews/photo", { method: "POST", body: fd });
    const d = await r.json();
    setUploading(false);
    if (!r.ok) return setError(d.error);
    setForm((f) => ({ ...f, photo: d.url }));
  }

  const list = data?.reviews ?? [];
  const shown = showAll ? list : list.slice(0, 6);

  return (
    <Reveal id="reviews" className="section">
      <div className="reviews-head">
        <div>
          <p className="eyebrow">{t("reviews.eyebrow")}</p>
          <h2>{t("reviews.title1")} <em>{t("reviews.title2")}</em> {t("reviews.title3")}</h2>
        </div>
        {data?.avg != null && (
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span className="big-rating">{data.avg}</span>
            <div>
              <div className="stars">{stars(Math.round(data.avg))}</div>
              <span className="small muted">from {data.count} reviews</span>
            </div>
          </div>
        )}
      </div>

      <div className="reviews">
        {shown.map((r) => (
          <article key={r.id} className="review card">
            <span className="stars">{stars(r.rating)}</span>
            {r.photo && (
              <button className="review-photo" onClick={() => setZoom(r.photo)} aria-label={`Open ${r.name}'s photo`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.photo} alt={`Photo from ${r.name}'s visit`} loading="lazy" />
              </button>
            )}
            <p>“{r.text}”</p>
            <footer>
              <span className="avatar">{r.name[0]?.toUpperCase()}</span>
              <span>{r.name}</span>
            </footer>
          </article>
        ))}
      </div>

      <div className="row" style={{ marginTop: "1.5rem" }}>
        {list.length > 6 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAll((s) => !s)}>{showAll ? "Show fewer" : `Show all ${list.length}`}</button>
        )}
        {!writing && <button className="btn btn-sm" onClick={() => setWriting(true)}>{t("reviews.write")}</button>}
      </div>

      {writing && (
        <form className="review-form card" onSubmit={submit}>
          <h3>How was your visit?</h3>
          <div className="star-pick" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" key={n} className={(hover || form.rating) >= n ? "lit" : ""} onMouseEnter={() => setHover(n)} onClick={() => setForm({ ...form, rating: n })} aria-label={`${n} stars`} role="radio" aria-checked={form.rating === n}>
                ★
              </button>
            ))}
          </div>
          <input className="input" required maxLength={40} placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <textarea className="input" required rows={3} maxLength={400} placeholder="Tell us about your favourite drink, seat, moment…" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
          <div className="row" style={{ alignItems: "center" }}>
            <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
              {uploading ? "Uploading…" : form.photo ? "📷 Change photo" : "📷 Add a photo"}
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => e.target.files?.[0] && addPhoto(e.target.files[0])} />
            </label>
            {form.photo && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.photo} alt="Your photo" className="review-thumb" />
                <button type="button" className="link-btn" onClick={() => setForm({ ...form, photo: "" })}>remove</button>
              </>
            )}
          </div>
          {error && <p className="error small">{error}</p>}
          <div className="row">
            <button className="btn btn-pink" disabled={uploading}>Post review</button>
            <button type="button" className="btn btn-ghost" onClick={() => setWriting(false)}>Cancel</button>
          </div>
        </form>
      )}
      {zoom && (
        <div className="lightbox" onClick={() => setZoom(null)} role="dialog" aria-modal="true" aria-label="Review photo">
          <button className="lb-close" aria-label="Close">✕</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="Review photo" />
        </div>
      )}
    </Reveal>
  );
}
