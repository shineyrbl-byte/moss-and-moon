"use client";
import Link from "next/link";
import BadgesCard from "@/components/BadgesCard";
import TierDietCards from "@/components/TierDietCards";
import WalletStudentCards from "@/components/WalletStudentCards";
import CompanyCard from "@/components/CompanyCard";
import MyDataCard from "@/components/MyDataCard";
import RegularOrders from "@/components/RegularOrders";
import BeanSubs from "@/components/BeanSubs";
import { Suspense } from "react";
import { useCallback, useEffect, useState } from "react";
import { PASS, REFERRAL_CREDIT, orderDue, rupees, type QuoteLine } from "@/lib/pricing";
import { usePay } from "@/components/Payment";
import { useStore } from "@/components/Store";

type Account = {
  signedIn: boolean;
  customer?: { name: string | null; email: string; phone: string | null; birthday: string | null; referralCode: string; credit: number; memberSince: string };
  stamps?: { count: number; rewardsUsed: number; needed: number };
  orders?: { code: string; status: string; total: number; giftcard_used: number; credit_used: number; tip: number; delivery_fee: number; created_at: string; lines: QuoteLine[] }[];
  pass?: { active: boolean; until: string | null; usedToday: boolean; price: number };
  perks?: { birthdayTreat: boolean; passDrink: boolean; credit: number; canUseInvite: boolean };
};

const post = (url: string, body: unknown, method = "POST") => fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function AccountPage() {
  const { refreshMe, toast } = useStore();
  const [acc, setAcc] = useState<Account | null>(null);

  const load = useCallback(async () => {
    const d = await fetch("/api/account").then((r) => r.json());
    setAcc(d);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!acc) return <div className="page center muted">Loading…</div>;
  if (!acc.signedIn) return <SignIn onDone={async () => { await refreshMe(); await load(); toast("Welcome ✿"); }} />;
  return <Profile acc={acc} reload={load} />;
}

function SignIn({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await post("/api/account/code", { email });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setError(d.error);
    setDemoCode(d.demoCode ?? "");
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await post("/api/account/verify", { email, code });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setError(d.error);
    onDone();
  }

  return (
    <div className="page" style={{ maxWidth: "30rem" }}>
      <p className="eyebrow">your account</p>
      <h1 style={{ fontSize: "clamp(2.4rem, 6vw, 3.6rem)" }}>Hello, <em>regular</em></h1>
      <p className="lead">Sign in with just your email. Your stamps, orders and favourites will follow you to any phone. No password needed.</p>
      {step === "email" ? (
        <form className="card signin" onSubmit={sendCode}>
          <label className="field">Email<input className="input" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
          {error && <p className="error small">{error}</p>}
          <button className="btn btn-pink full" disabled={busy}>{busy ? "Sending…" : "Email me a code"}</button>
        </form>
      ) : (
        <form className="card signin" onSubmit={verify}>
          <p className="small">We sent a 6-digit code to <b>{email}</b>. <button type="button" className="link-btn" onClick={() => { setStep("email"); setCode(""); }}>Change</button></p>
          {demoCode && (
            <div className="reward-banner small">
              🧪 <b>Demo mode:</b> emails aren&apos;t switched on yet, so here&apos;s your code: <b className="code" style={{ fontSize: "1rem", padding: "0.1rem 0.5rem" }}>{demoCode}</b>
            </div>
          )}
          <label className="field">Code<input className="input code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="••••••" /></label>
          {error && <p className="error small">{error}</p>}
          <button className="btn btn-pink full" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Sign in"}</button>
        </form>
      )}
    </div>
  );
}

function Profile({ acc, reload }: { acc: Account; reload: () => Promise<void> }) {
  const { refreshMe, toast } = useStore();
  const c = acc.customer!;
  const [form, setForm] = useState({ name: c.name ?? "", phone: c.phone ?? "", month: c.birthday?.slice(0, 2) ?? "", day: c.birthday?.slice(3) ?? "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const birthday = form.month && form.day ? `${form.month}-${form.day.padStart(2, "0")}` : undefined;
    const r = await post("/api/account", { name: form.name, phone: form.phone, ...(birthday && !c.birthday ? { birthday } : {}) }, "PATCH");
    const d = await r.json();
    setSaving(false);
    if (!r.ok) return setError(d.error);
    try { localStorage.setItem("mm-me", JSON.stringify({ name: form.name, phone: form.phone, email: c.email })); } catch {}
    toast("Saved ✿");
    await refreshMe();
    await reload();
  }

  async function logout() {
    await fetch("/api/account/logout", { method: "POST" });
    await refreshMe();
    await reload();
  }

  const s = acc.stamps!;
  const filled = Math.min(s.count, s.needed);

  return (
    <div className="page" style={{ maxWidth: "60rem" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p className="eyebrow">your account</p>
          <h1 style={{ fontSize: "clamp(2.4rem, 6vw, 3.6rem)" }}>Hi, <em>{c.name || "lovely"}</em></h1>
          <p className="muted small">{c.email} · member since {new Date(c.memberSince.replace(" ", "T")).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
      </div>

      <div className="account-grid">
        <form className="card account-card" onSubmit={save}>
          <h3>Your details</h3>
          <label className="field">Name<input className="input" maxLength={40} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="field">Phone (links your stamp card)<input className="input" inputMode="numeric" placeholder="10 digits" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <div className="field">Birthday {c.birthday ? "" : "(for a free birthday treat 🎂)"}
            <div className="row">
              <select className="input" value={form.month} disabled={!!c.birthday} onChange={(e) => setForm({ ...form, month: e.target.value })} aria-label="Birthday month">
                <option value="">Month</option>
                {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
              </select>
              <select className="input" value={form.day} disabled={!!c.birthday} onChange={(e) => setForm({ ...form, day: e.target.value })} aria-label="Birthday day">
                <option value="">Day</option>
                {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => <option key={d} value={d}>{Number(d)}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="error small">{error}</p>}
          <button className="btn btn-pink" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </form>

        <div className="card account-card">
          <h3>Stamp card</h3>
          {c.phone ? (
            <>
              <div className="stamps" style={{ margin: "0.5rem 0" }}>
                {Array.from({ length: s.needed }, (_, i) => (
                  <div key={i} className={`stamp ${i < filled ? "on" : ""} ${i === s.needed - 1 ? "reward" : ""}`}>{i < filled ? "☕" : i === s.needed - 1 ? "🎁" : ""}</div>
                ))}
              </div>
              <p className="small muted">{s.count >= s.needed ? "🎉 Free drink waiting on your next order!" : `${s.needed - filled} more to a free drink · ${s.rewardsUsed} enjoyed so far`}</p>
            </>
          ) : (
            <p className="muted small">Add your phone number to link your stamp card.</p>
          )}
          {c.credit > 0 && <p className="reward-banner small" style={{ marginTop: "0.8rem" }}>💝 You have <b>{rupees(c.credit)}</b> credit, used automatically at checkout.</p>}
        </div>
      </div>

      {acc.perks?.birthdayTreat && (
        <div className="reward-banner" style={{ marginTop: "1.2rem" }}>🎂 <b>Happy birthday week!</b> A free bake (up to ₹250) comes off your next order automatically.</div>
      )}

      <TierDietCards />
      <WalletStudentCards />
      <CompanyCard />
      <MyDataCard onDeleted={logout} />
      <BadgesCard />
      <p className="small center" style={{ margin: "0.6rem 0 1rem" }}><a href="/year">🗓 See your year at Moss &amp; Moon →</a> · <a href="/letters">✉️ Letters to future you</a> · <a href="/menu-explorer">🗺 Menu explorer</a></p>
      <RegularOrders />
      <Suspense fallback={null}><BeanSubs /></Suspense>

      <div className="account-grid">
        <PassCard acc={acc} reload={reload} />
        <InviteCard acc={acc} reload={reload} />
      </div>

      <div className="card account-card" style={{ marginTop: "1.2rem" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h3>Recent orders</h3>
          <Link href="/orders" className="link-btn">All orders</Link>
        </div>
        {!acc.orders?.length && <p className="muted small">No orders yet. <Link href="/#menu" className="link-btn">See the menu</Link></p>}
        {acc.orders?.slice(0, 6).map((o) => (
          <Link key={o.code} href={`/order/${o.code}`} className="account-order">
            <span><b>{o.code}</b> <span className={`status-tag ${o.status}`}>{o.status}</span></span>
            <span className="small muted">{o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}</span>
            <span>{rupees(orderDue(o))}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PassCard({ acc, reload }: { acc: Account; reload: () => Promise<void> }) {
  const pay = usePay();
  const { toast, refreshMe } = useStore();
  const [busy, setBusy] = useState(false);
  const p = acc.pass!;

  async function buy() {
    setBusy(true);
    const r = await fetch("/api/pass", { method: "POST" });
    const d = await r.json();
    if (!r.ok) {
      setBusy(false);
      return toast(d.error);
    }
    const ok = await pay("pass", d.code);
    setBusy(false);
    if (ok) toast("Your Coffee Pass is active ☕");
    await refreshMe();
    await reload();
  }

  const until = p.until ? new Date(p.until + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long" }) : "";
  return (
    <div className="card account-card pass-card">
      <h3>☕ Coffee Pass</h3>
      {p.active ? (
        <>
          <p><b>Active until {until}.</b> One drink a day is on us (up to {rupees(PASS.cap)}, extras like oat milk are extra).</p>
          <p className="small muted">{p.usedToday ? "Today's drink is done ✓, see you tomorrow!" : "Today's drink is still waiting. Just order while signed in."}</p>
          <button className="btn btn-ghost btn-sm" onClick={buy} disabled={busy}>Add another 30 days · {rupees(PASS.price)}</button>
        </>
      ) : (
        <>
          <p>{PASS.label}. That&apos;s about {rupees(Math.round(PASS.price / PASS.days))} a cup if you come daily.</p>
          <button className="btn btn-pink" onClick={buy} disabled={busy}>{busy ? "One moment…" : `Get the pass · ${rupees(PASS.price)}`}</button>
        </>
      )}
    </div>
  );
}

function InviteCard({ acc, reload }: { acc: Account; reload: () => Promise<void> }) {
  const { toast, refreshMe } = useStore();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const mine = acc.customer!.referralCode;
  const link = typeof window !== "undefined" ? `${window.location.origin}/account?invite=${mine}` : "";

  // Arrived from a friend's invite link? Fill the code in.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("invite");
    if (fromUrl && fromUrl !== mine) setCode(fromUrl);
  }, [mine]);

  async function share() {
    const text = `Come try Moss & Moon ☕ Sign up with my code ${mine} and we both get ${rupees(REFERRAL_CREDIT)} off!`;
    try {
      if (navigator.share) await navigator.share({ title: "Moss & Moon", text, url: link });
      else {
        await navigator.clipboard.writeText(`${text} ${link}`);
        toast("Invite copied, so paste it to a friend ✿");
      }
    } catch {}
  }

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const r = await fetch("/api/account/referral", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const d = await r.json();
    if (!r.ok) return setError(d.error);
    toast(`${rupees(d.credit)} credit added 💝`);
    await refreshMe();
    await reload();
  }

  return (
    <div className="card account-card">
      <h3>💝 Invite a friend</h3>
      <p>Give {rupees(REFERRAL_CREDIT)}, get {rupees(REFERRAL_CREDIT)}. Your friend gets {rupees(REFERRAL_CREDIT)} off when they sign up with your code, and you get {rupees(REFERRAL_CREDIT)} once they&apos;ve had their first order.</p>
      <div className="row" style={{ alignItems: "center" }}>
        <span className="code">{mine}</span>
        <button className="btn btn-sm" onClick={share}>Share invite</button>
      </div>
      {acc.perks?.canUseInvite && (
        <form className="row" onSubmit={redeem} style={{ marginTop: "0.5rem" }}>
          <input className="input" style={{ flex: 1 }} placeholder="Got a friend's code?" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button className="btn btn-ghost btn-sm" disabled={!code.trim()}>Use it</button>
        </form>
      )}
      {error && <p className="error small">{error}</p>}
    </div>
  );
}

