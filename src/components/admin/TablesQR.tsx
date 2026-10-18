"use client";
import { useEffect, useState } from "react";
import { TABLE_COUNT } from "@/lib/cafe";

// Printable QR codes, one per table. Guests scan → menu opens for that table.
export default function TablesQR() {
  const tables = Array.from({ length: TABLE_COUNT }, (_, i) => i + 1);
  const [wifi, setWifi] = useState<{ ssid: string; password: string; security: string; onTables: boolean } | null>(null);
  useEffect(() => {
    fetch("/api/admin/wifi").then((r) => (r.ok ? r.json() : null)).then(setWifi).catch(() => {});
  }, []);
  const showWifi = !!wifi?.ssid && wifi.onTables;
  return (
    <>
      <div className="row no-print" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <p className="muted" style={{ maxWidth: "40rem" }}>
          Print these and stand one on each table. Scanning opens the menu already set to that table; the order shows up in your queue with the table number,
          and the guest gets told it&apos;s on its way.
        </p>
        <div className="row">
          <a className="btn btn-ghost btn-sm" href="/board" target="_blank" rel="noreferrer">📺 Open TV board</a>
          <button className="btn btn-pink btn-sm" onClick={() => window.print()}>🖨 Print QR cards</button>
        </div>
      </div>
      <div className="qr-sheet">
        {tables.map((n) => (
          <div key={n} className="qr-card">
            <span className="logo" style={{ fontSize: "1.3rem" }}>Moss <span>&amp;</span> Moon</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/qr/${n}`} alt={`QR code for table ${n}`} width={160} height={160} />
            <strong>Table {n}</strong>
            <small>Scan to order from your seat ✿</small>
            {showWifi && (
              <span className="qr-wifi">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/api/admin/wifi/qr" alt="Wi-Fi QR code" width={64} height={64} />
                <small>📶 <b>{wifi!.ssid}</b>{wifi!.security !== "nopass" ? <><br />{wifi!.password}</> : null}</small>
              </span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
