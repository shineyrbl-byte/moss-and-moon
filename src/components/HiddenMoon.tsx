"use client";
import { useEffect, useState } from "react";
import { useStore } from "./Store";
import { MOONS, MOONS_KEY, allFound, cleanFound, type MoonId } from "@/lib/secret";

export function foundMoons(): MoonId[] {
  try { return cleanFound(JSON.parse(localStorage.getItem(MOONS_KEY) ?? "[]")); } catch { return []; }
}

/** One of the five small moons hidden around the site. Tap it to collect it. */
export default function HiddenMoon({ id, style }: { id: MoonId; style?: React.CSSProperties }) {
  const { toast, setSecret } = useStore();
  const [found, setFound] = useState(false);
  useEffect(() => setFound(foundMoons().includes(id)), [id]);
  async function collect(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (found) return toast(`🌙 Already found this one · ${foundMoons().length}/${MOONS.length}`);
    const all = [...new Set([...foundMoons(), id])];
    try { localStorage.setItem(MOONS_KEY, JSON.stringify(all)); } catch {}
    setFound(true);
    if (!allFound(all)) return toast(`🌙 You found a hidden moon! ${all.length}/${MOONS.length}`);
    toast("🌕 All five moons! The secret menu is open. Find it at /secret");
    const r = await fetch("/api/secret", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ found: all }) }).catch(() => null);
    const d = r?.ok ? await r.json() : null;
    if (Array.isArray(d?.items)) setSecret(d.items);
  }
  return <button type="button" className={`hidden-moon no-print ${found ? "found" : ""}`} style={style} onClick={collect} aria-label="A hidden moon" title={found ? "Found ✓" : undefined}>☾</button>;
}
