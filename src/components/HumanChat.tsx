"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLive } from "./useLive";
import { hoursOn } from "@/lib/cafe";
import { useStore } from "./Store";

type M = { id: number; sender: "guest" | "staff" | "system"; staff_name: string | null; text: string; created_at: string };
type Session = { code: string; token: string };
const KEY = "mm-support";
const json = (body: unknown) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export function savedSession(): Session | null {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}

/** The "talk to a person" side of the chat: messages go to whoever is on shift */
export default function HumanChat({ context, onBack }: { context: { role: string; content: string }[]; onBack: () => void }) {
  const { me } = useStore();
  const [session, setSession] = useState<Session | null>(null);
  const [msgs, setMsgs] = useState<M[]>([]);
  const [form, setForm] = useState({ name: "", email: "" });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [closed, setClosed] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const lastId = useRef(0);
  const openNow = !!hoursOn(new Date());

  useEffect(() => {
    setSession(savedSession());
    setForm({ name: me?.name ?? "", email: me?.email ?? "" });
  }, [me]);

  const load = useCallback(async () => {
    if (!session) return;
    const r = await fetch(`/api/support/${session.code}?token=${encodeURIComponent(session.token)}&after=${lastId.current}`);
    if (r.status === 404) { try { localStorage.removeItem(KEY); } catch {} setSession(null); return; }
    const d = await r.json();
    setClosed(d.status === "closed");
    if (d.messages.length) {
      lastId.current = d.messages.at(-1).id;
      setMsgs((m) => [...m, ...d.messages.filter((x: M) => !m.some((y) => y.id === x.id))]);
    }
  }, [session]);
  useEffect(() => { lastId.current = 0; setMsgs([]); load(); }, [load]);
  // Live replies, plus a slow backup check
  useLive(session ? `/api/live?topic=support&code=${session.code}&token=${encodeURIComponent(session.token)}` : null, () => load());
  useEffect(() => { const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [msgs]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setError("");
    if (!session) {
      const r = await fetch("/api/support", json({ ...form, text: t, context }));
      const d = await r.json();
      setBusy(false);
      if (!r.ok) return setError(d.error);
      const s = { code: d.code, token: d.token };
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
      setSession(s);
    } else {
      const r = await fetch(`/api/support/${session.code}`, json({ token: session.token, text: t }));
      setBusy(false);
      if (!r.ok) return setError((await r.json()).error);
      load();
    }
    setText("");
  }
  function endChat() {
    try { localStorage.removeItem(KEY); } catch {}
    setSession(null);
    setMsgs([]);
    onBack();
  }

  return (
    <>
      <div className="chat-list" ref={listRef} aria-live="polite">
        {!session && (
          <div className="bubble-row assistant">
            <div className="bubble assistant">
              {openNow
                ? "Someone from the team will reply here, usually within a few minutes. Ask about orders, allergies, bookings, anything."
                : "We're closed right now, but leave a message with your email and we'll reply when we open ✿"}
            </div>
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={`bubble-row ${m.sender === "guest" ? "user" : "assistant"}`}>
            {m.sender === "staff" && <small className="muted" style={{ marginLeft: "0.4rem" }}>{m.staff_name ?? "The team"}</small>}
            <div className={`bubble ${m.sender === "guest" ? "user" : "assistant"} ${m.sender === "system" ? "system" : ""}`}>{m.text}</div>
          </div>
        ))}
        {session && msgs.length > 0 && msgs.every((m) => m.sender === "guest") && <p className="tiny muted" style={{ textAlign: "center" }}>Sent. We&apos;ll reply here{form.email ? ` and by email if you've left` : ""}.</p>}
      </div>
      {error && <p className="error small" style={{ padding: "0 1rem" }}>{error}</p>}
      {!session && (
        <div className="row" style={{ padding: "0 0.8rem", gap: "0.4rem" }}>
          <input className="input" placeholder="Your name" aria-label="Your name" maxLength={40} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" type="email" placeholder={openNow ? "Email (optional)" : "Email"} aria-label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
      )}
      <form className="chat-input" onSubmit={send}>
        <input className="input" placeholder={session ? "Message the team" : "How can we help?"} value={text} maxLength={800} onChange={(e) => setText(e.target.value)} aria-label="Message the team" />
        <button className="btn btn-sm" disabled={busy || !text.trim() || (!session && !openNow && !form.email)} aria-label="Send">➤</button>
      </form>
      {session && <p className="tiny muted" style={{ textAlign: "center", margin: "-0.3rem 0 0.6rem" }}>{closed ? "This chat was closed. Send a message to reopen it. " : ""}<button className="link-btn tiny" onClick={endChat}>End chat</button></p>}
    </>
  );
}
