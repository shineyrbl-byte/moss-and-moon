"use client";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useStore } from "./Store";

const CALLS = [
  { reason: "help", label: "🙋 I need help" },
  { reason: "water", label: "💧 Water, please" },
  { reason: "order", label: "📝 Take my order" },
  { reason: "bill", label: "🧾 The bill, please" },
];

// Thin bar at the top when a guest scanned a table's QR code, with "Call staff"
export default function TableBanner() {
  const { table, setTable, toast } = useStore();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  if (!table || pathname?.startsWith("/admin") || pathname?.startsWith("/board") || pathname?.startsWith("/staff")) return null;

  async function call(reason: string) {
    setOpen(false);
    const r = await fetch("/api/tables/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table, reason }) });
    if (r.ok) {
      setSent(reason);
      toast("On our way! ✿");
      setTimeout(() => setSent(null), 60_000);
    } else toast("Couldn't reach the staff, please wave at us 👋");
  }

  return (
    <div className="table-banner" role="status">
      <span>🪑 You&apos;re at <b>table {table}</b>, so order here and we&apos;ll bring it over</span>
      <span className="call-wrap">
        <button className="call-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{sent ? "✓ Staff called" : "🔔 Call staff"}</button>
        {open && (
          <span className="call-menu" role="menu">
            {CALLS.map((c) => (
              <button key={c.reason} role="menuitem" onClick={() => call(c.reason)}>{c.label}</button>
            ))}
            <a role="menuitem" href="/songs" onClick={() => setOpen(false)}>🎵 Request a song</a>
          </span>
        )}
      </span>
      <button onClick={() => setTable(null)} aria-label="Stop ordering for this table">✕</button>
    </div>
  );
}
