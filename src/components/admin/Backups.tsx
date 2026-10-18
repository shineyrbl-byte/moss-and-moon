"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "../Store";

type B = { name: string; size: number; at: string };
const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Owner: backups made every night, plus download, back up now and restore */
export default function Backups() {
  const { toast } = useStore();
  const [list, setList] = useState<B[] | null>(null);
  const [confirm, setConfirm] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(() => fetch("/api/admin/backup").then((r) => r.json()).then((d) => setList(d.backups)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  async function now() {
    const r = await fetch("/api/admin/backup", { method: "POST" });
    toast(r.ok ? "Backed up ✓" : (await r.json()).error);
    load();
  }

  async function restore() {
    if (!confirm) return;
    setBusy(true);
    const r = await fetch("/api/admin/backup", { method: "PUT", body: confirm });
    const d = await r.json();
    setBusy(false);
    setConfirm(null);
    if (!r.ok) return toast(d.error);
    toast("Restored! Reloading…");
    setTimeout(() => window.location.reload(), 900);
  }

  return (
    <section className="card" style={{ padding: "1.2rem 1.3rem", display: "flex", flexDirection: "column", gap: "0.7rem" }}>
      <h3 style={{ fontSize: "1.3rem" }}>🗄 Backups</h3>
      <p className="small muted">A copy of everything (orders, bookings, accounts, reviews, menu) is saved every night and kept for 14 days. Uploaded photos aren&apos;t included.</p>
      <div className="row">
        <button className="btn btn-sm" onClick={now}>Back up now</button>
        <a className="btn btn-ghost btn-sm" href="/api/admin/backup?fresh=1">⬇ Download a fresh copy</a>
        <button className="btn btn-ghost btn-sm" onClick={() => input.current?.click()}>⬆ Restore from a file…</button>
        <input ref={input} type="file" accept=".gz,.db" hidden onChange={(e) => { setConfirm(e.target.files?.[0] ?? null); e.target.value = ""; }} />
      </div>
      {confirm && (
        <div className="reward-banner" role="alert">
          <p>Replace <b>all</b> current data with <b>{confirm.name}</b>? Today&apos;s data is backed up first, so you can undo this.</p>
          <div className="row" style={{ marginTop: "0.5rem" }}>
            <button className="btn btn-pink btn-sm" onClick={restore} disabled={busy}>{busy ? "Restoring…" : "Yes, restore it"}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        </div>
      )}
      {list && !list.length && <p className="small muted">No backups yet. The first one is made tonight (or tap “Back up now”).</p>}
      {list && list.length > 0 && (
        <ul className="backup-list">
          {list.slice(0, 7).map((b) => (
            <li key={b.name}>
              <span>{new Date(b.at).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{b.name.includes("before-restore") ? " · before restore" : b.name.includes("manual") ? " · manual" : ""}</span>
              <span className="muted">{kb(b.size)}</span>
              <a className="link-btn" href={`/api/admin/backup?file=${encodeURIComponent(b.name)}`}>Download</a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
