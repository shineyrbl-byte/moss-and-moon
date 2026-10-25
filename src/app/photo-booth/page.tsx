"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/components/Store";

// Everything happens on your phone: the camera picture, frame and stickers are put together here and saved to your device.
const W = 1080, H = 1350;
const FRAMES = {
  pink: { label: "Pink", bg: "#e391a8", ink: "#3b2720", sub: "#5a3a2c" },
  moss: { label: "Moss", bg: "#5f6f4e", ink: "#fffaf6", sub: "#e6ecd9" },
  polaroid: { label: "Polaroid", bg: "#fffaf6", ink: "#3b2720", sub: "#765749" },
  night: { label: "Moonlit", bg: "#1a120e", ink: "#f6da9e", sub: "#e6cfbd" },
} as const;
type Frame = keyof typeof FRAMES;
const STICKERS = ["☕", "🥐", "🌙", "🌸", "💖", "✨", "🍰", "🧋", "🐾", "🌿", "🎉", "😎", "🥭", "🌴"];
type Sticker = { e: string; x: number; y: number; size: number };
const BORDER = 48, BAND = 190; // photo sits inside these
const photoRect = () => ({ x: BORDER, y: BORDER, w: W - BORDER * 2, h: H - BORDER - BAND });

function compose(ctx: CanvasRenderingContext2D, src: CanvasImageSource | null, sw: number, sh: number, mirror: boolean, frame: Frame, stickers: Sticker[], selected: number | null, caption: string) {
  const f = FRAMES[frame], r = photoRect();
  ctx.fillStyle = f.bg; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.fillStyle = "#e6cfbd"; ctx.fillRect(r.x, r.y, r.w, r.h);
  if (src && sw && sh) {
    // Fill the photo area (cropping the edges), mirrored like a mirror for selfies
    const k = Math.max(r.w / sw, r.h / sh), dw = sw * k, dh = sh * k;
    const dx = r.x + (r.w - dw) / 2, dy = r.y + (r.h - dh) / 2;
    if (mirror) { ctx.translate(r.x * 2 + r.w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(src, dx, dy, dw, dh);
  }
  ctx.restore();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = f.ink; ctx.font = "600 76px Georgia, 'Times New Roman', serif";
  ctx.fillText("Moss & Moon", W / 2, H - BAND / 2 - 18);
  ctx.fillStyle = f.sub; ctx.font = "500 34px system-ui, sans-serif";
  ctx.fillText(caption, W / 2, H - BAND / 2 + 46);
  for (const [i, s] of stickers.entries()) {
    ctx.font = `${s.size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.fillText(s.e, s.x * W, s.y * H);
    if (i === selected) {
      ctx.strokeStyle = "#e391a8"; ctx.lineWidth = 6; ctx.setLineDash([16, 12]);
      ctx.strokeRect(s.x * W - s.size * 0.62, s.y * H - s.size * 0.62, s.size * 1.24, s.size * 1.24); ctx.setLineDash([]);
    }
  }
}

export default function PhotoBooth() {
  const { toast } = useStore();
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [still, setStill] = useState<HTMLImageElement | null>(null);
  const [camError, setCamError] = useState("");
  const [frame, setFrame] = useState<Frame>("pink");
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [shot, setShot] = useState<{ url: string; blob: Blob } | null>(null);
  const drag = useRef<{ i: number; dx: number; dy: number } | null>(null);
  const caption = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) + " · Goa";

  const stop = useCallback(() => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; setLive(false); }, []);
  useEffect(() => stop, [stop]);
  async function startCam() {
    setCamError(""); setStill(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
      stream.current = s;
      if (video.current) { video.current.srcObject = s; await video.current.play(); }
      setLive(true);
    } catch {
      setCamError("We couldn't open your camera. You can allow it in your browser settings, or use a photo from your phone instead.");
    }
  }
  function usePhoto(file: File | undefined) {
    if (!file) return;
    stop();
    const img = new Image();
    img.onload = () => setStill(img);
    img.src = URL.createObjectURL(file);
  }
  // Keep the preview drawn
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const ctx = canvas.current?.getContext("2d");
      if (ctx) {
        const v = video.current;
        if (live && v) compose(ctx, v, v.videoWidth, v.videoHeight, true, frame, stickers, sel, caption);
        else compose(ctx, still, still?.naturalWidth ?? 0, still?.naturalHeight ?? 0, false, frame, stickers, sel, caption);
      }
      if (live) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [live, still, frame, stickers, sel, caption]);

  const toCanvas = (e: React.PointerEvent) => { const b = canvas.current!.getBoundingClientRect(); return { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height }; };
  function down(e: React.PointerEvent) {
    const p = toCanvas(e);
    const i = [...stickers.keys()].reverse().find((k) => Math.abs(stickers[k].x - p.x) * W < stickers[k].size * 0.6 && Math.abs(stickers[k].y - p.y) * H < stickers[k].size * 0.6);
    if (i === undefined) { setSel(null); return; }
    setSel(i); drag.current = { i, dx: p.x - stickers[i].x, dy: p.y - stickers[i].y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const p = toCanvas(e);
    setStickers((list) => list.map((s, k) => (k === d.i ? { ...s, x: Math.min(1, Math.max(0, p.x - d.dx)), y: Math.min(1, Math.max(0, p.y - d.dy)) } : s)));
  }
  function add(e: string) {
    setStickers([...stickers, { e, x: 0.5 + (Math.random() - 0.5) * 0.3, y: 0.42 + (Math.random() - 0.5) * 0.3, size: 150 }]);
    setSel(stickers.length);
  }
  function snap() {
    setSel(null);
    let n = 3;
    setCount(n);
    const id = setInterval(() => {
      n--; setCount(n);
      if (n > 0) return;
      clearInterval(id);
      // Draw once more without the selection box, then keep it
      requestAnimationFrame(() => canvas.current?.toBlob((blob) => {
        if (!blob) return toast("Couldn't save that one. Try again?");
        setShot({ url: URL.createObjectURL(blob), blob }); stop();
      }, "image/jpeg", 0.92));
    }, live ? 800 : 0);
  }
  async function share() {
    if (!shot) return;
    const file = new File([shot.blob], "moss-and-moon.jpg", { type: "image/jpeg" });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "Moss & Moon" });
      else toast("Use Save instead on this device");
    } catch {}
  }
  function again() { if (shot) URL.revokeObjectURL(shot.url); setShot(null); setStickers([]); setStill(null); }

  return (
    <div className="page" style={{ maxWidth: "36rem" }}>
      <p className="eyebrow">say cheese</p>
      <h1 className="h2">Photo <em>booth</em></h1>
      <p className="small muted">Take a selfie, pick a frame, add stickers and save it to your phone. Nothing is uploaded: the photo never leaves your phone unless you share it.</p>
      {shot ? (
        <section className="booth-done">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shot.url} alt="Your Moss & Moon photo" className="booth-img" />
          <div className="row" style={{ justifyContent: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <a className="btn btn-pink btn-sm" href={shot.url} download="moss-and-moon.jpg">Save to my phone</a>
            {typeof navigator !== "undefined" && "share" in navigator && <button className="btn btn-ghost btn-sm" onClick={share}>Share</button>}
            <button className="btn btn-ghost btn-sm" onClick={again}>Take another</button>
          </div>
          <p className="tiny muted center">Tag us if you post it, we love seeing them 💕</p>
        </section>
      ) : (
        <>
          <div className="booth-stage">
            <canvas ref={canvas} width={W} height={H} className="booth-canvas" onPointerDown={down} onPointerMove={move} onPointerUp={() => (drag.current = null)} aria-label="Photo preview. Drag stickers to move them." />
            <video ref={video} playsInline muted className="booth-video" aria-hidden="true" />
            {count > 0 && <span className="booth-count" aria-live="assertive">{count}</span>}
            {!live && !still && (
              <div className="booth-start">
                <button className="btn btn-pink" onClick={startCam}>📸 Open the camera</button>
                <label className="btn btn-ghost btn-sm">Use a photo instead<input type="file" accept="image/*" hidden onChange={(e) => usePhoto(e.target.files?.[0])} /></label>
                {camError && <p className="small" role="alert">{camError}</p>}
              </div>
            )}
          </div>
          <div className="booth-tools">
            <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap" }} role="group" aria-label="Frame">
              {(Object.keys(FRAMES) as Frame[]).map((f) => <button key={f} className={`chip ${frame === f ? "on" : ""}`} aria-pressed={frame === f} onClick={() => setFrame(f)}><span className="booth-swatch" style={{ background: FRAMES[f].bg }} aria-hidden="true" />{FRAMES[f].label}</button>)}
            </div>
            <div className="booth-stickers" role="group" aria-label="Add a sticker">
              {STICKERS.map((s) => <button key={s} className="sd-key" onClick={() => add(s)} aria-label={`Add ${s} sticker`}>{s}</button>)}
            </div>
            {sel !== null && stickers[sel] && (
              <div className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <label className="small" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>Size<input type="range" min={60} max={360} value={stickers[sel].size} onChange={(e) => setStickers(stickers.map((s, k) => (k === sel ? { ...s, size: Number(e.target.value) } : s)))} /></label>
                <button className="chip" onClick={() => { setStickers(stickers.filter((_, k) => k !== sel)); setSel(null); }}>Remove sticker</button>
              </div>
            )}
            <div className="row" style={{ justifyContent: "center", gap: "0.5rem" }}>
              {(live || still) && <button className="btn btn-pink" onClick={snap} disabled={count > 0}>{live ? "📸 Take the photo (3, 2, 1…)" : "Save with frame"}</button>}
              {live && <button className="btn btn-ghost btn-sm" onClick={stop}>Close camera</button>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
