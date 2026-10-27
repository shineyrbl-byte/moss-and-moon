"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "@/components/Store";
import type { HowTo } from "@/lib/howTo";

// The guides (and their translations) load after the page is up, so pages that aren't games don't carry them
const HOWTO_KEY = "mm-howto-seen";
type Guides = { en: typeof import("@/lib/howTo").HOW_TO; i18n: typeof import("@/lib/howToI18n").HOW_TO_I18N; ui: typeof import("@/lib/howToI18n").HOWTO_UI };
let cache: Promise<Guides> | null = null;
const loadGuides = () => (cache ??= Promise.all([import("@/lib/howTo"), import("@/lib/howToI18n")]).then(([a, b]) => ({ en: a.HOW_TO, i18n: b.HOW_TO_I18N, ui: b.HOWTO_UI })));

/** The first time you open a game, a small card says what you're aiming for and the tip that helps most. The ? brings it back. */
export default function HowToPlay() {
  const path = usePathname();
  const { lang } = useStore();
  // The word games' cards come in Hindi, Marathi and Konkani too
  const [g, setG] = useState<Guides | null>(null);
  useEffect(() => { let on = true; loadGuides().then((x) => on && setG(x)).catch(() => {}); return () => { on = false; }; }, []);
  const how: HowTo | undefined = g ? (lang !== "en" && g.i18n[lang][path]) || g.en[path] : undefined;
  const ui = g && lang !== "en" && g.i18n[lang][path] ? g.ui[lang] : null;
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
      <b>{ui ? ui.newTo(how.title) : `New to ${how.title}?`}</b>
      <p className="small" style={{ margin: "0.2rem 0" }}><span aria-hidden="true">🎯 </span>{how.goal}</p>
      <p className="small" style={{ margin: "0.2rem 0 0.6rem" }}><span aria-hidden="true">💡 </span>{how.tip}</p>
      <button className="btn btn-pink btn-sm" onClick={close}>{ui ? ui.gotIt : "Got it"}</button>
    </aside>
  ) : (
    <div className="howto-bar"><button className="howto-q" onClick={() => setOpen(true)} aria-label={`How to play ${how.title}`} title="How to play">{ui ? ui.how : "? How to play"}</button></div>
  );
}
