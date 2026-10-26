"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { HOWTO_KEY, HOW_TO } from "@/lib/howTo";

/** The first time you open a game, a small card says what you're aiming for and the tip that helps most. The ? brings it back. */
export default function HowToPlay() {
  const path = usePathname();
  const how = HOW_TO[path];
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!how) return;
    try {
      const seen: string[] = JSON.parse(localStorage.getItem(HOWTO_KEY) ?? "[]");
      setOpen(!seen.includes(path));
    } catch { setOpen(false); }
  }, [path, how]);
  if (!how) return null;
  function close() {
    setOpen(false);
    try { const seen: string[] = JSON.parse(localStorage.getItem(HOWTO_KEY) ?? "[]"); if (!seen.includes(path)) localStorage.setItem(HOWTO_KEY, JSON.stringify([...seen, path])); } catch {}
  }
  return open ? (
    <aside className="howto card" role="note" aria-label={`How to play ${how.title}`}>
      <b>New to {how.title}?</b>
      <p className="small" style={{ margin: "0.2rem 0" }}><span aria-hidden="true">🎯 </span>{how.goal}</p>
      <p className="small" style={{ margin: "0.2rem 0 0.6rem" }}><span aria-hidden="true">💡 </span>{how.tip}</p>
      <button className="btn btn-pink btn-sm" onClick={close}>Got it</button>
    </aside>
  ) : (
    <div className="howto-bar"><button className="howto-q" onClick={() => setOpen(true)} aria-label={`How to play ${how.title}`} title="How to play">? How to play</button></div>
  );
}
