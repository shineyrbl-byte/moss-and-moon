"use client";
import { useEffect, useState } from "react";
import { ARCHIVE_GAMES } from "@/lib/archive";

/** "Save the puzzles for offline": the café's service worker fetches every daily puzzle so they open without signal */
export default function OfflineSave() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "none">("idle");
  const [saved, setSaved] = useState(0);
  useEffect(() => { if (!("serviceWorker" in navigator)) setState("none"); }, []);
  if (state === "none") return null;
  async function save() {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const ch = new MessageChannel();
      const got = new Promise<number>((ok) => { ch.port1.onmessage = (e) => ok(e.data?.saved ?? 0); setTimeout(() => ok(-1), 60_000); });
      reg.active?.postMessage({ type: "precache", urls: ["/games", ...ARCHIVE_GAMES.map((g) => g.href)] }, [ch.port2]);
      setSaved(await got); setState("done");
    } catch { setState("idle"); }
  }
  return (
    <p className="small" style={{ margin: "0.6rem 0" }}>
      {state === "done" ? (saved > 0 ? `📥 Saved ${saved} puzzles: they'll open even without signal. Save your score once you're back online.` : "Couldn't save them just now.")
        : <><button className="link-btn small" onClick={save} disabled={state === "busy"}>{state === "busy" ? "Saving the puzzles…" : "📥 Save the daily puzzles for offline"}</button> <span className="tiny muted">for the train, or a café with no signal</span></>}
    </p>
  );
}
