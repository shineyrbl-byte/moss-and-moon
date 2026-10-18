"use client";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { photo } from "@/lib/menu";
import { rupees } from "@/lib/pricing";
import { useStore } from "./Store";
import HumanChat, { savedSession } from "./HumanChat";
import { useSearchParams } from "next/navigation";

type Rec = { itemId: string; reason: string };
type Msg = { role: "user" | "assistant"; content: string; recs?: Rec[] };

const STARTERS = ["Something sweet but not too strong", "I need energy for studying ☕", "Iced & dairy-free please", "What's pink and pretty? 🌸"];
const HELLO: Msg = { role: "assistant", content: "Hi, I'm Mo, your barista ✿ Tell me your mood, your cravings or your dietary needs and I'll pour you a match." };

// Floating "Ask the barista" chat. Remembers the conversation for this visit.
export default function BaristaChat() {
  const pathname = usePathname();
  const { find, setCustomizing, soldOut, t } = useStore();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([HELLO]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const [human, setHuman] = useState(false);
  const params = useSearchParams();
  // Coming back to an ongoing chat with the team (or from the reply email link)
  useEffect(() => {
    const s = savedSession();
    if (s) setHuman(true);
    if (s && params.get("chat") === s.code) setOpen(true);
  }, [params]);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("mm-chat") || "null");
      if (Array.isArray(saved) && saved.length) setMsgs(saved);
    } catch {}
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem("mm-chat", JSON.stringify(msgs.slice(-30))); } catch {}
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  // Not on staff pages or the TV board
  if (pathname?.startsWith("/admin") || pathname?.startsWith("/board")) return null;

  async function send(content: string) {
    const t = content.trim();
    if (!t || busy) return;
    setError("");
    const next: Msg[] = [...msgs, { role: "user", content: t }];
    setMsgs(next);
    setText("");
    setBusy(true);
    try {
      const r = await fetch("/api/barista", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // (the server skips the greeting, since a chat has to start with the guest)
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setDemo(d.mode === "demo");
      setMsgs((m) => [...m, { role: "assistant", content: d.reply, recs: d.recommendations }]);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Couldn't reach the barista. Try again?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className={`chat-fab ${open ? "open" : ""}`} onClick={() => setOpen((o) => !o)} aria-label={open ? "Close barista chat" : "Ask the barista"} aria-expanded={open}>
        {open ? "✕" : <><span aria-hidden>☕</span><span className="chat-fab-label">{t("chat.ask")}</span></>}
      </button>

      {open && (
        <section className="chat card" aria-label="Barista chat">
          <header className="chat-head">
            <span className="chat-avatar" aria-hidden>☕</span>
            <div>
              <strong>{human ? "The Moss & Moon team" : "Mo the barista"}</strong>
              <small className="muted">{human ? "real people, on shift now" : demo ? "demo mode · keyword matching" : "usually replies in seconds"}</small>
            </div>
            {human
              ? <button className="link-btn" style={{ marginLeft: "auto" }} onClick={() => setHuman(false)}>Back to Mo</button>
              : <button className="link-btn" style={{ marginLeft: "auto" }} onClick={() => { setMsgs([HELLO]); setError(""); }}>New chat</button>}
          </header>
          {human ? <HumanChat context={msgs.slice(1).map(({ role, content }) => ({ role, content }))} onBack={() => setHuman(false)} /> : <>

          <div className="chat-list" ref={listRef}>
            {msgs.map((m, i) => (
              <div key={i} className={`bubble-row ${m.role}`}>
                <div className={`bubble ${m.role}`}>{m.content}</div>
                {m.recs?.map((r) => {
                  const item = find(r.itemId);
                  if (!item) return null;
                  const out = soldOut.has(item.id);
                  return (
                    <div key={r.itemId} className="rec">
                      <div className="rec-ph"><Image src={photo(item.img, 200)} alt="" fill sizes="64px" /></div>
                      <div className="rec-info">
                        <strong>{item.name}</strong>
                        <small className="muted">{r.reason}</small>
                        <small>{rupees(item.price)}</small>
                      </div>
                      <button className="btn btn-pink btn-sm" disabled={out} onClick={() => setCustomizing(item)}>{out ? "Sold out" : "Add"}</button>
                    </div>
                  );
                })}
              </div>
            ))}
            {busy && <div className="bubble-row assistant"><div className="bubble assistant typing"><span /><span /><span /></div></div>}
            {msgs.length === 1 && !busy && (
              <div className="chat-starters">
                {STARTERS.map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}
              </div>
            )}
          </div>

          {error && <p className="error small" style={{ padding: "0 1rem" }}>{error}</p>}
          <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <input className="input" placeholder="What are you in the mood for?" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} aria-label="Message the barista" />
            <button className="btn btn-sm" disabled={busy || !text.trim()} aria-label="Send">➤</button>
          </form>
          <p className="tiny muted" style={{ textAlign: "center", margin: "-0.3rem 0 0.6rem" }}><button className="link-btn tiny" onClick={() => setHuman(true)}>👋 Talk to a person instead</button></p>
          </>}
        </section>
      )}
    </>
  );
}
