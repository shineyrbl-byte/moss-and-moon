"use client";
import { useEffect, useState } from "react";
import { useStore } from "../Store";

const json = (body: unknown) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** Owner: turn on a 6-digit code from an authenticator app at login */
export default function TwoStep() {
  const { toast } = useStore();
  const [s, setS] = useState<{ enabled: boolean; backupLeft: number } | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState<string[] | null>(null);
  const [turningOff, setTurningOff] = useState(false);

  const load = () => fetch("/api/admin/2fa").then((r) => (r.ok ? r.json() : null)).then(setS).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!s) return null;

  async function post(body: object) {
    const r = await fetch("/api/admin/2fa", json(body));
    const d = await r.json();
    if (!r.ok) { toast(d.error); return null; }
    return d;
  }

  return (
    <section className="card" style={{ padding: "1.2rem 1.3rem", display: "flex", flexDirection: "column", gap: "0.7rem" }}>
      <div className="sum-row" style={{ alignItems: "center" }}>
        <h3 style={{ fontSize: "1.3rem" }}>🔐 Two-step login</h3>
        <span className={`status-tag ${s.enabled ? "promo-live" : ""}`}>{s.enabled ? "on" : "off"}</span>
      </div>
      {backup ? (
        <div className="reward-banner">
          <p><b>Save these backup codes somewhere safe.</b> Each works once if you lose your phone. You won&apos;t see them again.</p>
          <pre className="backup-codes">{backup.join("\n")}</pre>
          <div className="row">
            <button className="btn btn-sm" onClick={() => { navigator.clipboard?.writeText(backup.join("\n")); toast("Copied ✓"); }}>Copy</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setBackup(null); load(); }}>I&apos;ve saved them</button>
          </div>
        </div>
      ) : s.enabled ? (
        <>
          <p className="small muted">After your passcode or password, the login also asks for the 6-digit code from your authenticator app. {s.backupLeft} backup codes left.</p>
          {turningOff ? (
            <form className="row" onSubmit={async (e) => { e.preventDefault(); if (await post({ action: "off", code })) { toast("Two-step login is off"); setTurningOff(false); setCode(""); load(); } }}>
              <input className="input" style={{ maxWidth: 180 }} inputMode="numeric" autoComplete="one-time-code" placeholder="Current code" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Current code" />
              <button className="btn btn-ghost btn-sm">Turn off</button>
            </form>
          ) : (
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setTurningOff(true)}>Turn off…</button>
          )}
        </>
      ) : setup ? (
        <>
          <ol className="small" style={{ paddingLeft: "1.1rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, or your password manager).</li>
            <li>Add an account and scan this QR code, or type the key below.</li>
            <li>Enter the 6-digit code it shows.</li>
          </ol>
          <div className="row" style={{ alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:image/svg+xml;utf8,${encodeURIComponent(setup.qr)}`} alt="QR code to add Moss & Moon to your authenticator app" width={160} height={160} style={{ borderRadius: 12, background: "#fff", padding: 6 }} />
            <code className="small" style={{ wordBreak: "break-all", maxWidth: 260 }}>{setup.secret.match(/.{1,4}/g)?.join(" ")}</code>
          </div>
          <form className="row" onSubmit={async (e) => { e.preventDefault(); const d = await post({ action: "confirm", code }); if (d) { setBackup(d.backupCodes); setSetup(null); setCode(""); toast("Two-step login is on 🔐"); } }}>
            <input className="input" style={{ maxWidth: 160 }} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Code from your app" />
            <button className="btn btn-pink btn-sm">Turn it on</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSetup(null)}>Cancel</button>
          </form>
        </>
      ) : (
        <>
          <p className="small muted">Even if someone learns your passcode, they can&apos;t get in without the code from your phone. Recommended for the owner account.</p>
          <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={async () => { const d = await post({ action: "start" }); if (d) setSetup(d); }}>Set it up</button>
        </>
      )}
    </section>
  );
}
