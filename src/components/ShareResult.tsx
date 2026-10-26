"use client";
import { useRef } from "react";
import { useStore } from "@/components/Store";

/** The line people share once a daily puzzle is done */
export function shareText(title: string, date: string, result: string) {
  const nice = new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `Moss & Moon · ${title} · ${nice}\n${result.replace(/\s+/g, " ").trim()}`;
}

/** A share button for a puzzle's "done" card. It shares the card's headline (time, hints, moves), so every puzzle says it its own way. */
export default function ShareResult({ title, date }: { title: string; date: string }) {
  const { toast } = useStore();
  const me = useRef<HTMLButtonElement>(null);
  async function share() {
    const head = me.current?.closest(".memory-done")?.querySelector("b")?.textContent ?? "";
    const text = shareText(title, date, head);
    const url = `${location.origin}${location.pathname}${location.search}`;
    try {
      if (navigator.share) await navigator.share({ text, url });
      else { await navigator.clipboard.writeText(`${text}\n${url}`); toast("Copied, ready to paste 📋"); }
    } catch {}
  }
  return <button ref={me} type="button" className="btn btn-ghost btn-sm share-result" onClick={share}>📤 Share</button>;
}
