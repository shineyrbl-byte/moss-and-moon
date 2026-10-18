"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLive } from "./useLive";

type Row = { code: string; name: string; email: string | null; status: string; last_at: string; unread: number; last_text: string };
type M = { id: number; sender: "guest" | "staff" | "system"; staff_name: string | null; text: string; created_at: string };
type Chat = { code: string; name: string; status: string; email: string | null; context: string | null; messages: M[] };
const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const ago = (t: string) => {
  const m = Math.round((Date.now() - new Date(t.replace(" ", "T")).getTime()) / 60_000);
  return m < 1 ? "now" : m < 60 ? `${m}m` : `${Math.round(m / 60)}h`;
};

/** Staff: chats from guests who tapped "talk to a person". A button that opens a side panel. */
export default function SupportInbox({ onNew }: { onNew?: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState<Chat | null>(null);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const unreadBefore = useRef<number | null>(null);
  const current = useRef<string | null>(null);
  current.current = chat?.code ?? null;

  const loadList = useCallback(async () => {
    const r = await fetch("/api/support");
    if (!r.ok) return;
    const list = (await r.json()) as Row[];
    setRows(list);
    const unread = list.reduce((s, x) => s + x.unread, 0);
    if (unreadBefore.current !== null && unread > unreadBefore.current) onNew?.();
    unreadBefore.current = unread;
  }, [onNew]);
  const loadChat = useCallback(async (code: string) => {
    const r = await fetch(`/api/support/${code}`);
    if (r.ok) setChat(await r.json());
  }, []);
  useEffect(() => { loadList(); const t = setInterval(loadList, 30_000); return () => clearInterval(t); }, [loadList]);
  useLive("/api/live?topic=staff", (e) => {
    if (e.type !== "support") return;
    if (current.current === e.code && open) loadChat(String(e.code)).then(loadList);
    else loadList();
  });
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [chat]);

  async function reply(e: React.FormEvent) {
    e.preventDefault();
    if (!chat || !text.trim()) return;
    const r = await fetch(`/api/support/${chat.code}`, json("POST", { text }));
    if (r.ok) { setText(""); loadChat(chat.code); }
  }
  async function setStatus(status: string) {
    if (!chat) return;
    await fetch(`/api/support/${chat.code}`, json("PATCH", { status }));
    loadChat(chat.code);
    loadList();
  }
  const unread = rows.reduce((s, x) => s + x.unread, 0);
  const openCount = rows.filter((r) => r.status === "open").length;

  return (
    <>
      <button className={`chip ${unread ? "on" : ""}`} onClick={() => setOpen(true)} aria-label={`Guest chats, ${unread} unread`}>
        💬 Chats{unread ? ` · ${unread} new` : openCount ? ` · ${openCount}` : ""}
      </button>
      {open && (
        <>
          <div className="overlay show" onClick={() => setOpen(false)} />
          <aside className="drawer open support-drawer card" role="dialog" aria-label="Guest chats">
            <header className="chat-head">
              {chat ? <button className="link-btn" onClick={() => { setChat(null); loadList(); }}>← All chats</button> : <strong>💬 Guest chats</strong>}
              {chat && <span><strong>{chat.name}</strong>{chat.email && <small className="muted"> · {chat.email}</small>}</span>}
              <button className="icon-btn" style={{ marginLeft: "auto" }} onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </header>
            {!chat ? (
              <div className="chat-list">
                {!rows.length && <p className="muted small">No chats yet. When a guest taps “Talk to a person” in the barista chat, it shows up here.</p>}
                {rows.map((r) => (
                  <button key={r.code} className={`support-row ${r.unread ? "unread" : ""}`} onClick={() => loadChat(r.code)}>
                    <span><b>{r.name}</b> <small className="muted">{r.status === "closed" ? "closed · " : ""}{ago(r.last_at)}</small></span>
                    <small className="muted">{r.last_text?.slice(0, 80)}</small>
                    {r.unread > 0 && <span className="support-badge">{r.unread}</span>}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="chat-list" ref={listRef}>
                  {chat.context && <details className="small muted"><summary>What they asked Mo first</summary><p style={{ whiteSpace: "pre-line" }}>{chat.context}</p></details>}
                  {chat.messages.map((m) => (
                    <div key={m.id} className={`bubble-row ${m.sender === "staff" ? "user" : "assistant"}`}>
                      <div className={`bubble ${m.sender === "staff" ? "user" : "assistant"} ${m.sender === "system" ? "system" : ""}`}>{m.text}</div>
                      <small className="muted tiny">{m.sender === "staff" ? `${m.staff_name} · ` : ""}{m.created_at.slice(11, 16)}</small>
                    </div>
                  ))}
                </div>
                <form className="chat-input" onSubmit={reply}>
                  <input className="input" placeholder={`Reply to ${chat.name}`} aria-label="Reply" maxLength={800} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
                  <button className="btn btn-sm" disabled={!text.trim()} aria-label="Send">➤</button>
                </form>
                <p className="tiny muted" style={{ textAlign: "center", margin: "-0.3rem 0 0.6rem" }}>
                  {chat.email ? "If they've left the page, they'll get your reply by email. " : ""}
                  <button className="link-btn tiny" onClick={() => setStatus(chat.status === "open" ? "closed" : "open")}>{chat.status === "open" ? "Close chat" : "Reopen"}</button>
                </p>
              </>
            )}
          </aside>
        </>
      )}
    </>
  );
}
