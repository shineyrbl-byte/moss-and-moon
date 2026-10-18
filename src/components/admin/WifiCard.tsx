"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";

type W = { ssid: string; password: string; security: "WPA" | "WEP" | "nopass"; onReceipts: boolean; onTables: boolean };

/** Owner: the café Wi-Fi, as a scan-to-join QR on receipts and table cards */
export default function WifiCard() {
  const { toast } = useStore();
  const [w, setW] = useState<W | null>(null);
  useEffect(() => {
    fetch("/api/admin/wifi").then((r) => r.json()).then(setW).catch(() => {});
  }, []);
  if (!w) return null;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/wifi", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(w) });
    const d = await r.json();
    if (!r.ok) return toast(d.error);
    setW(d);
    toast("Wi-Fi saved ✓");
  }
  return (
    <form className="card" onSubmit={save} style={{ padding: "1.2rem 1.3rem", display: "flex", flexDirection: "column", gap: "0.7rem" }}>
      <h3 style={{ fontSize: "1.3rem" }}>📶 Guest Wi-Fi</h3>
      <div className="row">
        <label className="field">Network name<input className="input" maxLength={32} value={w.ssid} onChange={(e) => setW({ ...w, ssid: e.target.value })} placeholder="MossAndMoon-Guest" /></label>
        <label className="field">Password<input className="input" maxLength={63} value={w.password} onChange={(e) => setW({ ...w, password: e.target.value })} disabled={w.security === "nopass"} /></label>
        <label className="field" style={{ maxWidth: "10rem" }}>Security
          <select className="input" value={w.security} onChange={(e) => setW({ ...w, security: e.target.value as W["security"] })}>
            <option value="WPA">WPA/WPA2</option><option value="WEP">WEP</option><option value="nopass">Open (no password)</option>
          </select>
        </label>
      </div>
      <label className="row small" style={{ alignItems: "center", gap: "0.4rem" }}><input type="checkbox" checked={w.onReceipts} onChange={(e) => setW({ ...w, onReceipts: e.target.checked })} /> On receipts</label>
      <label className="row small" style={{ alignItems: "center", gap: "0.4rem" }}><input type="checkbox" checked={w.onTables} onChange={(e) => setW({ ...w, onTables: e.target.checked })} /> On table QR cards (Tables &amp; QR tab)</label>
      <button className="btn btn-sm" style={{ alignSelf: "flex-start" }}>Save</button>
      <p className="tiny muted">Guests scan the code with their phone camera to join. It&apos;s never shown on the public website.</p>
    </form>
  );
}
