"use client";
import { usePathname } from "next/navigation";
import { useStore } from "./Store";

// Thin bar at the top when a guest scanned a table's QR code
export default function TableBanner() {
  const { table, setTable } = useStore();
  const pathname = usePathname();
  if (!table || pathname?.startsWith("/admin") || pathname?.startsWith("/board")) return null;
  return (
    <div className="table-banner" role="status">
      <span>🪑 You&apos;re at <b>table {table}</b> — order here and we&apos;ll bring it over</span>
      <button onClick={() => setTable(null)} aria-label="Stop ordering for this table">✕</button>
    </div>
  );
}
