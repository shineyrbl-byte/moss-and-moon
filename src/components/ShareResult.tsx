"use client";
import { useRef } from "react";
import { useStore } from "@/components/Store";

/** The line people share once a daily puzzle is done */
export function shareText(title: string, date: string, result: string) {
  const nice = new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `Moss & Moon · ${title} · ${nice}\n${result.replace(/\s+/g, " ").trim()}`;
}

/** Draw a square result card: café colours, the puzzle, the day and your result */
export function drawCard(title: string, date: string, result: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 1080;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 1080, 1080);
  g.addColorStop(0, "#f9dce3"); g.addColorStop(1, "#e6cfbd");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1080);
  ctx.fillStyle = "#fffaf6"; ctx.beginPath(); ctx.roundRect(90, 150, 900, 780, 60); ctx.fill();
  ctx.fillStyle = "#3b2720"; ctx.textAlign = "center";
  ctx.font = "italic 64px Georgia, serif"; ctx.fillText("Moss & Moon", 540, 110);
  ctx.font = "bold 84px Georgia, serif"; ctx.fillText(title, 540, 330);
  const nice = new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  ctx.fillStyle = "#765749"; ctx.font = "44px system-ui, sans-serif"; ctx.fillText(nice, 540, 410);
  // The result, wrapped to fit
  ctx.fillStyle = "#c25b78"; ctx.font = "bold 60px system-ui, sans-serif";
  const words = result.replace(/\s+/g, " ").trim().split(" "), lines: string[] = [];
  for (const w of words) { const l = lines[lines.length - 1]; if (l && ctx.measureText(`${l} ${w}`).width < 780) lines[lines.length - 1] = `${l} ${w}`; else lines.push(w); }
  lines.slice(0, 4).forEach((l, i) => ctx.fillText(l, 540, 560 + i * 80));
  ctx.fillStyle = "#765749"; ctx.font = "38px system-ui, sans-serif"; ctx.fillText("Same puzzle for everyone today ☕", 540, 870);
  return c;
}

/** Share buttons for a puzzle's "done" card. They share the card's headline (time, hints, moves), so every puzzle says it its own way. */
export default function ShareResult({ title, date }: { title: string; date: string }) {
  const { toast } = useStore();
  const me = useRef<HTMLSpanElement>(null);
  const head = () => me.current?.closest(".memory-done")?.querySelector("b")?.textContent ?? "";
  async function share() {
    const text = shareText(title, date, head());
    const url = `${location.origin}${location.pathname}${location.search}`;
    try {
      if (navigator.share) await navigator.share({ text, url });
      else { await navigator.clipboard.writeText(`${text}\n${url}`); toast("Copied, ready to paste 📋"); }
    } catch {}
  }
  async function picture() {
    const blob = await new Promise<Blob | null>((ok) => drawCard(title, date, head()).toBlob(ok, "image/png"));
    if (!blob) return toast("Couldn't make the picture on this browser.");
    const file = new File([blob], `moss-and-moon-${title.toLowerCase().replace(/[^a-z]+/g, "-")}-${date}.png`, { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: shareText(title, date, head()) }); return; }
    } catch { return; }
    // No sharing of pictures here: save it instead
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file); a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("Picture saved 🖼");
  }
  return (
    <span ref={me} className="share-result row" style={{ gap: "0.4rem", justifyContent: "center" }}>
      <button type="button" className="btn btn-ghost btn-sm" onClick={share}>📤 Share</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={picture}>🖼 Picture</button>
    </span>
  );
}
