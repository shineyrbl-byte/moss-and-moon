"use client";
import { useEffect, useRef, useState } from "react";
import { getHistory } from "@/lib/history";
import { describeOptions, type Options } from "@/lib/pricing";
import { useStore } from "./Store";

// The browser's built-in speech recognition (Chrome, Edge, Safari). Free, nothing to set up.
type Rec = { lang: string; interimResults: boolean; maxAlternatives: number; start: () => void; stop: () => void; onresult: ((e: { results: { 0: { transcript: string } }[] & { length: number } }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };
declare global {
  interface Window { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }
}

/** 🎙 "Two iced oat lattes and a croissant" → added to the tray */
export default function VoiceOrder() {
  const { add, toast, setDrawerOpen, lang, find } = useStore();
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<"idle" | "listening" | "thinking">("idle");
  const [heard, setHeard] = useState("");
  const rec = useRef<Rec | null>(null);

  useEffect(() => setSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition)), []);
  if (!supported) return null;

  async function handle(text: string) {
    setState("thinking");
    setHeard(text);
    try {
      const r = await fetch("/api/voice-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const d = await r.json();
      if (!r.ok) return toast(d.error);
      const added: string[] = [];
      if (d.usual) {
        const u = await fetch(`/api/usual?codes=${encodeURIComponent(getHistory().map((o) => o.code).join(","))}`).then((x) => x.json());
        if (u.usual && !u.usual.soldOut) {
          add(u.usual.itemId, u.usual.opts, 1);
          added.push(`your usual ${u.usual.name}`);
        }
      }
      for (const l of d.lines as { itemId: string; qty: number; opts: Options; name: string }[]) {
        add(l.itemId, l.opts, l.qty);
        const item = find(l.itemId);
        const note = item ? describeOptions(item, l.opts) : "";
        added.push(`${l.qty > 1 ? `${l.qty} × ` : ""}${l.name}${note ? ` (${note})` : ""}`);
      }
      if (!added.length) return toast(`Heard “${text}”, but couldn't match it to the menu. Try saying the drink's name?`);
      toast(`Added ${added.join(", ")} ✿`);
      setDrawerOpen(true);
    } catch {
      toast("Couldn't reach the café. Try again?");
    } finally {
      setState("idle");
    }
  }

  function start() {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) return;
    if (state === "listening") return rec.current?.stop();
    const r = new R();
    r.lang = lang === "hi" || lang === "kok" ? "hi-IN" : lang === "mr" ? "mr-IN" : "en-IN";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => handle(e.results[0][0].transcript);
    r.onerror = (e) => {
      setState("idle");
      if (e.error === "not-allowed") toast("Allow the microphone to order by voice.");
      else if (e.error !== "aborted" && e.error !== "no-speech") toast("Didn't catch that. Try again?");
    };
    r.onend = () => setState((s) => (s === "listening" ? "idle" : s));
    rec.current = r;
    setHeard("");
    setState("listening");
    r.start();
  }

  return (
    <div className="voice">
      <button className={`voice-btn ${state}`} onClick={start} aria-pressed={state === "listening"} aria-label={state === "listening" ? "Stop listening" : "Order by voice"} disabled={state === "thinking"}>
        <span aria-hidden>🎙</span>
        <span className="voice-label">{state === "listening" ? "Listening…" : state === "thinking" ? "Adding…" : "Say your order"}</span>
      </button>
      <span className="sr-only" aria-live="polite">{state === "listening" ? "Listening" : heard ? `Heard: ${heard}` : ""}</span>
      {state === "listening" && <span className="small muted voice-hint">Try “an iced oat latte and a croissant” or “my usual”</span>}
    </div>
  );
}
