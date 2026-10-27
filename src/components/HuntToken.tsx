"use client";
// The weekend puzzle hunt's hidden key: on Saturdays and Sundays it shows on this weekend's five pages
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { todayStr } from "@/lib/archive";
import { HUNT_SIZE, huntFor, huntKey } from "@/lib/puzzleHunt";
import { addFlag } from "@/lib/trophyFlags";

export function foundKeys(key: string): string[] {
  try { const v = JSON.parse(localStorage.getItem(huntKey(key)) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}

export default function HuntToken() {
  const path = usePathname();
  const [state, setState] = useState<{ key: string; found: string[] } | null>(null);
  const [just, setJust] = useState(false);
  useEffect(() => {
    setJust(false);
    const h = huntFor(todayStr());
    setState(h && h.spots.some((s) => s.path === path) ? { key: h.key, found: foundKeys(h.key) } : null);
  }, [path]);
  if (!state || (state.found.includes(path) && !just)) return null;
  function pick() {
    const found = [...new Set([...state!.found, path])];
    try { localStorage.setItem(huntKey(state!.key), JSON.stringify(found)); } catch {}
    if (found.length >= HUNT_SIZE) addFlag("hunt-done");
    setState({ ...state!, found }); setJust(true);
  }
  return just ? (
    <p className="hunt-token found" role="status">🗝️ {state.found.length} of {HUNT_SIZE} keys found! <Link href="/puzzle-hunt">See the riddles</Link></p>
  ) : (
    <button className="hunt-token" onClick={pick} aria-label="A hidden key for the weekend puzzle hunt: pick it up">🗝️</button>
  );
}
