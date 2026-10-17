"use client";
import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// "Install app" — shows only when the browser says the site can be installed.
// On iPhone (no install prompt) it explains Share → Add to Home Screen instead.
export default function InstallButton({ className = "btn btn-ghost btn-sm" }: { className?: string }) {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    setInstalled(!!standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const f = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", f);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", f);
  }, []);

  if (installed || (!evt && !ios)) return null;
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button
        className={className}
        onClick={async () => {
          if (evt) {
            await evt.prompt();
            setEvt(null);
          } else setHint((h) => !h);
        }}
      >
        📲 Install the app
      </button>
      {hint && <span className="install-hint">Tap the Share button <b>⎋</b>, then <b>Add to Home Screen</b> ✿</span>}
    </span>
  );
}
