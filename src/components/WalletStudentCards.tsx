"use client";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "./Store";
import { usePay } from "./Payment";
import { isStudentEmail, rupees } from "@/lib/pricing";

type W = { balance: number; topups: { amount: number; bonus: number }[]; history: { amount: number; bonus: number; created_at: string }[] };
const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** Account page: the coffee wallet, and the student discount */
export default function WalletStudentCards() {
  const { me, refreshMe, toast } = useStore();
  const pay = usePay();
  const [w, setW] = useState<W | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const load = useCallback(() => fetch("/api/account/wallet").then((r) => (r.ok ? r.json() : null)).then(setW).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (me?.email && isStudentEmail(me.email)) setEmail(me.email); }, [me?.email]);
  if (!me || !w) return null;

  async function topUp(amount: number) {
    setBusy(true);
    const r = await post("/api/account/wallet", { amount });
    const d = await r.json();
    if (!r.ok) { setBusy(false); return toast(d.error); }
    const ok = await pay("wallet", d.code, { name: me!.name ?? undefined, email: me!.email });
    setBusy(false);
    if (ok) { toast(`Added ${rupees(d.amount + d.bonus)} to your wallet ✿`); await refreshMe(); load(); }
  }
  async function student(body: object) {
    setBusy(true);
    const r = await post("/api/account/student", body);
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return toast(d.error);
    if (d.verified) { toast("Student discount on 🎓"); setSent(false); await refreshMe(); return; }
    setSent(true);
    if (d.demoCode) setCode(d.demoCode);
    toast("Code sent to your college email");
  }
  const until = me.perks?.studentUntil;

  return (
    <div className="account-grid" style={{ marginTop: "1.2rem" }}>
      <div className="card account-card">
        <h3>👛 Coffee wallet</h3>
        <p><span style={{ fontSize: "1.8rem", fontFamily: "var(--serif, Georgia, serif)" }}>{rupees(w.balance)}</span> <span className="muted small">to spend</span></p>
        <p className="small muted">Top up once and checkout takes it off automatically. Bigger top-ups get a bonus.</p>
        <div className="chips" style={{ justifyContent: "flex-start" }}>
          {w.topups.map((t) => <button key={t.amount} className="chip" disabled={busy} onClick={() => topUp(t.amount)}>{rupees(t.amount)} <span className="extra">+{rupees(t.bonus)}</span></button>)}
        </div>
        {w.history.length > 0 && <p className="tiny muted" style={{ marginTop: "0.6rem" }}>Last top-up: {rupees(w.history[0].amount)} (+{rupees(w.history[0].bonus)}) on {w.history[0].created_at.slice(0, 10)}</p>}
      </div>
      <div className="card account-card">
        <h3>🎓 Student discount</h3>
        {me.perks?.student ? (
          <p className="success">✓ 10% off drinks on weekdays, until {new Date(until + "T12:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.</p>
        ) : (
          <>
            <p className="small muted">Studying? Verify your college email once for 10% off drinks every weekday for a year.</p>
            {!sent ? (
              <form className="row" onSubmit={(e) => { e.preventDefault(); student({ email }); }}>
                <input className="input" type="email" placeholder="you@college.ac.in" aria-label="College email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <button className="btn btn-pink btn-sm" disabled={busy || !isStudentEmail(email)}>Verify</button>
              </form>
            ) : (
              <form className="row" onSubmit={(e) => { e.preventDefault(); student({ code }); }}>
                <input className="input" inputMode="numeric" placeholder="6-digit code" aria-label="Code from the email" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                <button className="btn btn-pink btn-sm" disabled={busy || code.length !== 6}>Confirm</button>
              </form>
            )}
            {email && !isStudentEmail(email) && <p className="tiny muted">It needs to end in .ac.in, .edu or similar.</p>}
          </>
        )}
      </div>
    </div>
  );
}
