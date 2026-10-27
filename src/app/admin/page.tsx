"use client";
import { GamesDashboard, GoaSpotsCard } from "@/components/admin/GamesAdmin";
import { ComingSoonCard, GameNightCard, GoaEventsCard, MonthlyCard, RecipeWeekCard } from "@/components/admin/CafeExtrasAdmin";
import "./page.css";
import { useCallback, useEffect, useRef, useState } from "react";
import MenuEditor from "@/components/admin/MenuEditor";
import TablesQR from "@/components/admin/TablesQR";
import Analytics from "@/components/admin/Analytics";
import Team from "@/components/admin/Team";
import StockTab from "@/components/admin/StockTab";
import { ORDER_STEPS, activeBranches, findBranch, type OrderStatus } from "@/lib/cafe";
import { orderDue, rupees, type QuoteLine } from "@/lib/pricing";
import { useStore } from "@/components/Store";
import { SEASONS } from "@/lib/seasons";
import EventsTab from "@/components/admin/EventsTab";
import OwnerEmails from "@/components/admin/OwnerEmails";
import RefundButton from "@/components/admin/RefundButton";
import RotaTab from "@/components/admin/RotaTab";
import Backups from "@/components/admin/Backups";
import HealthTab from "@/components/admin/HealthTab";
import PromosTab from "@/components/admin/PromosTab";
import InsightsCard from "@/components/admin/InsightsCard";
import ProfitPanel from "@/components/admin/ProfitPanel";
import WasteTab from "@/components/admin/WasteTab";
import NoticesTab from "@/components/admin/NoticesTab";
import VisitorsPanel from "@/components/admin/VisitorsPanel";
import TwoStep from "@/components/admin/TwoStep";
import GmailConnect from "@/components/admin/GmailConnect";
import HoursEditor from "@/components/admin/HoursEditor";
import BranchesCard from "@/components/admin/BranchesCard";
import LinksCard from "@/components/admin/LinksCard";
import GstCard from "@/components/admin/GstCard";
import NewsletterTab from "@/components/admin/NewsletterTab";
import GuestsTab from "@/components/admin/GuestsTab";
import JournalTab from "@/components/admin/JournalTab";
import WifiCard from "@/components/admin/WifiCard";
import RetentionPanel from "@/components/admin/RetentionPanel";
import CashupTab from "@/components/admin/CashupTab";
import PnlTab from "@/components/admin/PnlTab";
import CateringTab from "@/components/admin/CateringTab";
import SupportInbox from "@/components/SupportInbox";
import WinbackCard from "@/components/admin/WinbackCard";
import SpecialsCard from "@/components/admin/SpecialsCard";
import CombosCard from "@/components/admin/CombosCard";
import CakesTab from "@/components/admin/CakesTab";
import RotationCard from "@/components/admin/RotationCard";
import MenuTidyCard from "@/components/admin/MenuTidyCard";
import ImportCard from "@/components/admin/ImportCard";
import DemoResetCard from "@/components/admin/DemoResetCard";
import SimCard from "@/components/admin/SimCard";
import ShelfCard from "@/components/admin/ShelfCard";
import PhotosCard from "@/components/admin/PhotosCard";
import SongsCard from "@/components/admin/SongsCard";
import ForwardCard from "@/components/admin/ForwardCard";
import TableTagsCard from "@/components/admin/TableTagsCard";
import ComebackCard from "@/components/admin/ComebackCard";
import NearbyCard from "@/components/admin/NearbyCard";
import ApprovalQueue, { ApprovalCount } from "@/components/admin/ApprovalQueue";
import ThanksNotes from "@/components/ThanksNotes";
import BookClubCard from "@/components/admin/BookClubCard";
import WishesCard from "@/components/admin/WishesCard";
import { BlindDateCard, CupsCard, PollCard, StoriesCard } from "@/components/admin/CommunityCards";
import { KindNotesCard, LostFoundCard, ScoreboardCard } from "@/components/admin/FrontDeskCards";
import { GuestRecipesCard, ISpyCard, LatteArtCard } from "@/components/admin/FunCards";
import { ArtCard, Connect4Card, StoryChainCard } from "@/components/admin/PlayCards";
import { AdoptCard, AskCard, ShoutoutsCard } from "@/components/admin/GuestCards";
import { QuizCard } from "@/components/admin/QuizCard";
import TeamProfiles from "@/components/admin/TeamProfiles";
import OpenTabs from "@/components/admin/OpenTabs";
import DeliveryZonesCard from "@/components/admin/DeliveryZonesCard";
import OwnerAlertsCard from "@/components/admin/OwnerAlertsCard";
import PriceWhatIf from "@/components/admin/PriceWhatIf";
import MenuEngineering from "@/components/admin/MenuEngineering";
import MissedSales from "@/components/admin/MissedSales";
import NoShowLine from "@/components/admin/NoShowLine";
import UseByCard from "@/components/admin/UseByCard";
import PriceWatch from "@/components/admin/PriceWatch";
import TrainingTab from "@/components/admin/TrainingTab";
import CompaniesTab from "@/components/admin/CompaniesTab";
import SetupCard from "@/components/admin/SetupCard";
import RushControl from "@/components/RushControl";
import ChecklistsTab from "@/components/admin/ChecklistsTab";
import AggregatorsCard from "@/components/admin/AggregatorsCard";
import { useLive } from "@/components/useLive";

type Stats = {
  todayOrders: number; todayRevenue: number; activeOrders: number; bookingsToday: number; guestsToday: number;
  rating: number | null; reviewCount: number; subscribers: number; members: number; allTimeOrders: number; allTimeRevenue: number;
  giftCards: number; giftSold: number; giftOutstanding: number; paidOnline: number;
  top: { name: string; qty: number }[]; days: { day: string; label: string; revenue: number; orders: number }[];
};
type Order = { branch?: string; id: number; code: string; name: string; phone: string; table_no: number | null; email: string | null; pickup: string; note: string; lines: QuoteLine[]; total: number; giftcard_used: number; credit_used: number; tip: number; delivery_fee: number; delivery_address: string | null; pay_method: string; pay_status: string; status: OrderStatus; created_at: string; refund_amount: number; paid_shares?: number };
type Gift = { code: string; amount: number; balance: number; from_name: string; to_name: string; to_email: string; paid: number; created_at: string };
type Email = { id: number; to_email: string; subject: string; html: string; status: string; error: string | null; created_at: string };
type Booking = { id: number; code: string; name: string; phone: string; date: string; time: string; guests: number; note: string; status: string; branch?: string; high_chairs?: number; deposit?: number; deposit_status?: string | null; table_no: number | null; preorder: string | null; preorder_code: string | null };
type Review = { id: number; name: string; rating: number; text: string; created_at: string; private?: number };

const TABS = ["Overview", "Analytics", "Orders", "Bookings", "Cakes", "Events", "Catering", "Companies", "Menu", "Stock", "Waste", "Checklists", "Cash-up", "P&L", "Tables & QR", "Team", "Rota", "Training", "Promos", "Guests", "Gift cards", "Newsletter", "Journal", "Emails", "Reviews", "Notices", "Games", "Health", "Settings"] as const;
type Tab = (typeof TABS)[number];
// The tabs, grouped so there's less to scan
const SECTIONS: { label: string; icon: string; tabs: Tab[] }[] = [
  { label: "Today", icon: "☀︎", tabs: ["Overview", "Orders", "Bookings", "Cakes", "Checklists", "Cash-up"] },
  { label: "Menu & stock", icon: "☕", tabs: ["Menu", "Stock", "Waste", "Tables & QR"] },
  { label: "Guests", icon: "💌", tabs: ["Guests", "Reviews", "Events", "Catering", "Companies", "Promos", "Gift cards", "Newsletter", "Notices", "Journal", "Games"] },
  { label: "Team", icon: "👥", tabs: ["Team", "Rota", "Training"] },
  { label: "Money", icon: "📈", tabs: ["Analytics", "P&L"] },
  { label: "Settings", icon: "⚙︎", tabs: ["Settings", "Emails", "Health"] },
];
/** Words that find a tab in "Jump to…" */
const KEYWORDS: Partial<Record<Tab, string>> = {
  Games: "puzzles games players where in goa photos dashboard",
  Orders: "swiggy zomato aggregator delivery apps songs music requests playlist pay it forward suspended coffee cups saved own cup reusable",
  Settings: "simulate simulation day in the life fake orders import csv spreadsheet excel demo reset alerts notifications push phone hours holidays golden hour last-hour branches delivery areas pincode google whatsapp gmail email gst invoice wifi wi-fi backups two-step 2fa owner email",
  Analytics: "profit menu engineering missed sales price what if retention coming back visitors insights",
  Stock: "ingredients use-by expiry supplier prices reorder shop stock",
  Checklists: "opening closing fridge temperature equipment repairs maintenance",
  "Cash-up": "till cash float upi card",
  "P&L": "expenses rent wages profit loss",
  Menu: "special of the day printable menu poster recipes story instagram combos combo deals allergen chart tv bring it back vote comeback secret menu",
  Notices: "quiz night live quiz pub quiz host tv shout-outs shoutouts birthday messages tv board questions ask us anything faq story chain connect four guests vs barista game latte art pour recipe swap guest recipes i spy kids lost found lost property left behind notes for a stranger kind notes noticeboard around the corner nearby places guide wish tree wishes poll six-word stories",
  Events: "book club reading artist wall art gallery paintings artist of the month adopt adoption shelter pets dogs cats",
  Team: "thank you notes kind words",
  Reviews: "guest photos doodles doodle wall pup wall",
  Rota: "shifts swaps staffing",
  Training: "quiz stations",
  Guests: "we miss you vip regulars birthdays",
  Bookings: "deposits no-show waitlist tables high chair shelf blind date books hints scoreboard board game wins",
  Cakes: "whole cake birthday",
  Health: "errors security uptime",
  Emails: "sent emails preview",
  "Tables & QR": "qr codes table cards",
};
// What baristas can see (owners see everything)
const BARISTA_TABS: Tab[] = ["Orders", "Bookings", "Cakes", "Events", "Menu", "Stock", "Waste", "Checklists", "Cash-up", "Tables & QR", "Rota", "Training", "Notices"];

// A soft two-note "ding" when a new order arrives
function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = "sine";
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.65);
    });
  } catch {}
}
const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export default function AdminPage() {
  const { toast } = useStore();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [me, setMe] = useState<{ id: number; name: string; role: "owner" | "barista" } | null>(null);
  const [pass, setPass] = useState("");
  const [username, setUsername] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [otp, setOtp] = useState("");
  const [tab, setTabState] = useState<Tab>("Overview");
  const [jump, setJump] = useState("");
  // Remember the tab in the address (so a refresh or a shared link opens it)
  const setTab = useCallback((t: Tab) => { setTabState(t); try { history.replaceState(null, "", `#${encodeURIComponent(t)}`); } catch {} }, []);
  useEffect(() => {
    const h = decodeURIComponent(location.hash.slice(1));
    if ((TABS as readonly string[]).includes(h)) setTabState(h as Tab);
  }, []);
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [waitlist, setWaitlist] = useState<{ id: number; name: string; phone: string; email: string; date: string; time: string; guests: number }[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [mail, setMail] = useState<{ emails: Email[]; emailMode: string; emailProvider: string | null; emailFrom: string | null; paymentMode: string } | null>(null);
  const [preview, setPreview] = useState<Email | null>(null);
  const [demoBarista, setDemoBarista] = useState<boolean | null>(null);
  const [season, setSeason] = useState<{ season: string; seasonNow: string | null } | null>(null);
  const lastMaxId = useRef<number | null>(null);

  const load = useCallback(async () => {
    const who = await fetch("/api/admin/me");
    if (who.status === 401) return setAuthed(false);
    const staff = await who.json();
    setMe(staff);
    setAuthed(true);
    const owner = staff.role === "owner";
    fetch("/api/admin/settings").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) { setDemoBarista(d.demoBarista); setSeason({ season: d.season, seasonNow: d.seasonNow }); } }).catch(() => {});
    const ownerOnly = (url: string, fallback: unknown) => (owner ? fetch(url).then((r) => r.json()) : Promise.resolve(fallback));
    const [o, b, rv, gc, em, st] = await Promise.all([
      fetch(`/api/orders${showDone ? "" : "?active=1"}`).then((r) => r.json()),
      fetch("/api/bookings").then((r) => r.json()),
      fetch("/api/reviews").then((r) => r.json()),
      ownerOnly("/api/giftcards", []),
      ownerOnly("/api/admin/emails", null),
      ownerOnly("/api/admin/stats", null),
    ]);
    setStats(st);
    // New order since last check? Play the chime.
    const maxId = Math.max(0, ...(o as Order[]).map((x) => x.id));
    if (lastMaxId.current !== null && maxId > lastMaxId.current) chime();
    lastMaxId.current = maxId;
    document.title = `(${(o as Order[]).filter((x) => x.status === "received").length}) Staff · Moss & Moon`;
    setOrders(o);
    setGifts(gc);
    setMail(em);
    setBookings(b);
    fetch("/api/waitlist").then((r) => (r.ok ? r.json() : [])).then(setWaitlist).catch(() => {});
    setReviews(rv.reviews);
  }, [showDone]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000); // backup refresh; live updates come instantly
    return () => clearInterval(t);
  }, [load]);

  useLive(authed ? "/api/live?topic=staff" : null, (e) => e.type !== "menu" && load());
  useEffect(() => {
    if (me && me.role !== "owner" && !BARISTA_TABS.includes(tab)) setTabState("Orders");
  }, [me, tab]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/login", json("POST", { username, password: pass, ...(needCode ? { code: otp } : {}) }));
    if (!r.ok) {
      const d = await r.json();
      if (d.needCode) setNeedCode(true);
      return setLoginErr(d.error);
    }
    setNeedCode(false);
    setOtp("");
    const d = await r.json();
    setPass("");
    if (d.staff?.role !== "owner") setTab("Orders");
    load();
  }

  async function toggleDemoBarista() {
    const r = await fetch("/api/admin/settings", json("PATCH", { demoBarista: !demoBarista }));
    if (r.ok) setDemoBarista((await r.json()).demoBarista);
  }

  async function changeSeason(v: string) {
    const r = await fetch("/api/admin/settings", json("PATCH", { season: v }));
    if (r.ok) {
      const d = await r.json();
      setSeason({ season: d.season, seasonNow: d.seasonNow });
      window.location.reload(); // repaint the whole site in the new theme
    }
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthed(false);
  }

  async function advance(o: Order) {
    const next = ORDER_STEPS[ORDER_STEPS.indexOf(o.status) + 1];
    if (!next) return;
    await fetch(`/api/orders/${o.code}`, json("PATCH", { status: next }));
    toast(`${o.code} → ${next}`);
    load();
  }

  async function setBooking(b: Booking, status: string) {
    await fetch("/api/bookings", json("PATCH", { code: b.code, status }));
    load();
  }


  async function deleteReview(id: number) {
    await fetch(`/api/reviews/${id}`, { method: "DELETE" });
    load();
  }

  if (authed === null) return <div className="page center muted">Loading…</div>;

  if (!authed)
    return (
      <div className="page" style={{ maxWidth: "26rem" }}>
        <p className="eyebrow">staff only</p>
        <h1 style={{ fontSize: "3rem" }}>Behind the <em>counter</em></h1>
        <form className="card" style={{ padding: "1.5rem", marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.8rem" }} onSubmit={login}>
          <label className="field">Username <span className="small">(leave empty if you&apos;re the owner)</span><input className="input" autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} /></label>
          <label className="field">{username.trim() ? "Password" : "Owner passcode"}<input className="input" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} /></label>
          {needCode && (
            <label className="field">6-digit code from your authenticator app (or a backup code)
              <input className="input" inputMode="numeric" autoComplete="one-time-code" autoFocus value={otp} onChange={(e) => setOtp(e.target.value)} />
            </label>
          )}
          {loginErr && <p className="error small">{loginErr}</p>}
          <button className="btn btn-pink">{needCode ? "Check code" : "Log in"}</button>
          <p className="small muted">Owners log in with the passcode set in ADMIN_PASSCODE. Staff get their own username from the owner (Team tab).</p>
        </form>
      </div>
    );

  const maxDay = Math.max(1, ...(stats?.days.map((d) => d.revenue) ?? [1]));
  const maxTop = Math.max(1, ...(stats?.top.map((t) => t.qty) ?? [1]));

  return (
    <div className="admin">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p className="eyebrow">staff dashboard</p>
          <h1 style={{ fontSize: "clamp(2.2rem, 5vw, 3.4rem)" }}>Good day, <em>{me?.role === "owner" && me.id === 0 ? "boss" : me?.name.split(" ")[0] ?? "barista"}</em> ☕</h1>
          <p className="small muted">Signed in as {me?.name} · {me?.role}</p>
        </div>
        <div className="row">
          <RushControl />
          <SupportInbox onNew={chime} />
          <a className="btn btn-pink btn-sm" href="/staff">☕ Barista screen</a>
          <a className="btn btn-ghost btn-sm" href="/kiosk" title="Open on a counter tablet so guests can order themselves">🖥 Kiosk</a>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Log out</button>
        </div>
      </div>

      {(() => {
        const allowed = (t: Tab) => me?.role === "owner" || BARISTA_TABS.includes(t);
        const sections = SECTIONS.map((x) => ({ ...x, tabs: x.tabs.filter(allowed) })).filter((x) => x.tabs.length);
        const current = sections.find((x) => x.tabs.includes(tab)) ?? sections[0];
        const q = jump.trim().toLowerCase();
        const matches = q ? TABS.filter(allowed).filter((t) => t.toLowerCase().includes(q) || (KEYWORDS[t] ?? "").includes(q)) : [];
        const label = (t: Tab) => `${t}${t === "Orders" && stats?.activeOrders ? ` (${stats.activeOrders})` : ""}`;
        return (
          <nav className="admin-nav" aria-label="Dashboard sections">
            <div className="admin-sections">
              {sections.map((x) => (
                <button key={x.label} className={`admin-section ${x === current ? "on" : ""}`} aria-current={x === current ? "true" : undefined} onClick={() => setTab(x.tabs[0])}>
                  <span aria-hidden>{x.icon}</span> {x.label}
                </button>
              ))}
              <label className="admin-jump">
                <span className="sr-only">Jump to</span>
                <input className="input" placeholder="Jump to… (e.g. wifi, rota)" value={jump} onChange={(e) => setJump(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) { setTab(matches[0]); setJump(""); } if (e.key === "Escape") setJump(""); }} />
                {q && (
                  <span className="admin-jump-list" role="listbox">
                    {matches.length ? matches.slice(0, 6).map((t) => <button key={t} role="option" aria-selected={false} onClick={() => { setTab(t); setJump(""); }}>{t}</button>) : <span className="muted small">Nothing matches</span>}
                  </span>
                )}
              </label>
            </div>
            {current.tabs.length > 1 && (
              <div className="admin-tabs">
                {current.tabs.map((t) => <button key={t} className={`chip ${tab === t ? "on" : ""}`} aria-pressed={tab === t} onClick={() => setTab(t)}>{label(t)}</button>)}
              </div>
            )}
          </nav>
        );
      })()}

      {tab === "Overview" && stats && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {me?.role === "owner" && <SetupCard go={(t) => setTab(t as Tab)} />}
          <ApprovalCount go={() => setTab("Notices")} />
          {mail && (
            <div className="mode-banner">
              <span>💳 Payments: <b>{mail.paymentMode === "razorpay" ? "Razorpay (live)" : "demo mode"}</b></span>
              <span>✉️ Emails: <b>{mail.emailProvider === "gmail-api" || mail.emailProvider === "gmail" ? `sending as Moss & Moon via Gmail` : mail.emailMode === "live" ? "sending via Resend" : "preview only (see Emails tab)"}</b></span>
              <span>🔔 A chime plays when a new order comes in, so keep this tab open.</span>
            </div>
          )}
          {season && (
            <div className="mode-banner">
              <span>
                🎉 Seasonal theme: <b>{season.seasonNow ? SEASONS[season.seasonNow as keyof typeof SEASONS].name : "none right now"}</b>
                {season.season === "auto" ? " (follows the calendar: Diwali, monsoon, Christmas, Valentine's)" : ""}
              </span>
              {me?.role === "owner" && (
                <label className="row" style={{ alignItems: "center", gap: "0.4rem" }}>
                  <span className="small">Theme</span>
                  <select className="input" style={{ width: "auto" }} value={season.season} onChange={(e) => changeSeason(e.target.value)}>
                    <option value="auto">Automatic</option>
                    <option value="off">Off</option>
                    {Object.values(SEASONS).map((s) => <option key={s.id} value={s.id}>Always {s.name} (preview)</option>)}
                  </select>
                </label>
              )}
            </div>
          )}
          {demoBarista !== null && (
            <div className="mode-banner">
              <span>
                🤖 Demo barista: <b>{demoBarista ? "on" : "off"}</b>.{" "}
                {demoBarista
                  ? "Orders move along by themselves (brewing after 1 min, ready at 3, collected at 15). Turn this off when real staff run the counter."
                  : "Staff move orders along on the barista screen."}
              </span>
              {me?.role === "owner" && (
                <button className="btn btn-ghost btn-sm" onClick={toggleDemoBarista} aria-pressed={demoBarista}>
                  {demoBarista ? "Turn off" : "Turn on"}
                </button>
              )}
            </div>
          )}
          <div className="kpis">
            <div className="kpi card"><span>Orders today</span><strong>{stats.todayOrders}</strong></div>
            <div className="kpi card"><span>Revenue today</span><strong>{rupees(stats.todayRevenue)}</strong></div>
            <div className="kpi card"><span>In the queue</span><strong>{stats.activeOrders}</strong></div>
            <div className="kpi card"><span>Bookings today</span><strong>{stats.bookingsToday}</strong><small className="muted">{stats.guestsToday} guests</small></div>
            <div className="kpi card"><span>Rating</span><strong>{stats.rating ?? "–"} ★</strong><small className="muted">{stats.reviewCount} reviews</small></div>
            <div className="kpi card"><span>Stamp members</span><strong>{stats.members}</strong></div>
            <div className="kpi card"><span>Newsletter</span><strong>{stats.subscribers}</strong></div>
            <div className="kpi card"><span>Paid online</span><strong>{stats.paidOnline}</strong><small className="muted">orders</small></div>
            <div className="kpi card"><span>Gift cards sold</span><strong>{rupees(stats.giftSold)}</strong><small className="muted">{stats.giftCards} cards · {rupees(stats.giftOutstanding)} unspent</small></div>
            <div className="kpi card"><span>All-time revenue</span><strong>{rupees(stats.allTimeRevenue)}</strong><small className="muted">{stats.allTimeOrders} orders</small></div>
          </div>
          <div className="row" style={{ alignItems: "stretch" }}>
            <div className="card" style={{ padding: "1.5rem", flex: "1 1 320px" }}>
              <h3>Last 7 days</h3>
              <div className="week">
                {stats.days.map((d) => (
                  <div key={d.day} title={`${rupees(d.revenue)} · ${d.orders} orders`}>
                    <small>{d.revenue ? rupees(d.revenue) : ""}</small>
                    <i style={{ height: `${(d.revenue / maxDay) * 100}%` }} />
                    {d.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{ padding: "1.5rem", flex: "1 1 320px" }}>
              <h3 style={{ marginBottom: "1rem" }}>Best sellers</h3>
              {!stats.top.length && <p className="muted">No orders yet.</p>}
              <div className="bars">
                {stats.top.map((t) => (
                  <div key={t.name} className="bar-row">
                    <span>{t.name}</span>
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${(t.qty / maxTop) * 100}%` }} /></div>
                    <strong>{t.qty}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "Orders" && (
        <>
          <OpenTabs />
          <SongsCard />
          <ForwardCard />
          <CupsCard canEdit={me?.role === "owner"} />
          <AggregatorsCard />
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <label className="small muted" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show collected orders too
            </label>
            <a className="btn btn-ghost btn-sm" href="/api/orders?format=csv">⬇ Download all orders (CSV)</a>
          </div>
          {!orders.length && <p className="muted">No orders in the queue. Time for a coffee yourself ☕</p>}
          <div className="order-cards">
            {orders.map((o) => {
              const next = ORDER_STEPS[ORDER_STEPS.indexOf(o.status) + 1];
              return (
                <div key={o.code} className="order-card card">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <strong>{o.code}{activeBranches().length > 1 && <span className="branch-tag">{findBranch(o.branch).name}</span>}</strong>
                    <span>
                      <span className={`status-tag ${o.pay_status}`}>{o.pay_status === "refunded" ? "refunded" : o.pay_status === "paid" ? (o.pay_method === "giftcard" ? "gift card" : "paid") : o.pay_status === "pending" ? "awaiting payment" : "pay at counter"}</span>{" "}
                      <span className={`status-tag ${o.status}`}>{o.status}</span>
                    </span>
                  </div>
                  {o.table_no && <span className="table-tag">🪑 Table {o.table_no}: bring it over</span>}
                  {o.delivery_address && <a className="table-tag" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.delivery_address)}`} target="_blank" rel="noreferrer">🛵 {o.delivery_address}</a>}
                  {o.tip > 0 && <span className="small">💛 includes {rupees(o.tip)} tip</span>}
                  <span className="small muted">{o.name}{o.phone ? ` · ${o.phone}` : ""} · {o.table_no ? "dine-in" : `pickup ${o.pickup === "asap" ? "ASAP" : o.pickup}`} · {o.created_at.slice(11, 16)}</span>
                  <ul>
                    {o.lines.map((l, i) => <li key={i}>{l.qty} × {l.name}{l.note && <small className="muted"> ({l.note})</small>}</li>)}
                  </ul>
                  {o.note && <span className="small">📝 {o.note}</span>}
                  {o.refund_amount > 0 && <span className="small">↩ {rupees(o.refund_amount)} refunded</span>}
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <strong>{rupees(orderDue(o))}</strong>
                    <span className="row" style={{ gap: "0.4rem" }}>
                      <a className="btn btn-ghost btn-sm" href={`/print/${o.code}`} target="_blank" rel="noreferrer" aria-label={`Print kitchen ticket for ${o.code}`}>🖨</a>
                      {next && <button className="btn btn-pink btn-sm" onClick={() => advance(o)}>Mark {next} →</button>}
                    </span>
                  </div>
                  {me?.role === "owner" && (o.pay_method === "online" || (o.paid_shares ?? 0) > 0) && (
                    <RefundButton code={o.code} refundable={(o.pay_status === "paid" || o.pay_status === "refunded" ? orderDue(o) : (o.paid_shares ?? 0)) - o.refund_amount} onDone={load} />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "Bookings" && (
        <div className="card table-wrap" style={{ padding: "1rem" }}>
          <NoShowLine />
          {!bookings.length ? <p className="muted">No upcoming bookings.</p> : (
            <table className="table">
              <thead><tr><th>Date</th><th>Time</th><th>Name</th><th>Guests</th><th>Table</th><th>Phone</th><th>Note</th><th>Status</th><th /></tr></thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.code} style={{ opacity: b.status === "cancelled" ? 0.45 : 1 }}>
                    <td>{b.date}</td><td>{b.time}</td><td>{b.name}<br /><small className="muted">{b.code}</small>{activeBranches().length > 1 && <span className="branch-tag">{findBranch(b.branch).name}</span>}</td><td>{b.guests}{b.high_chairs ? <><br /><small>🧸 {b.high_chairs} high chair{b.high_chairs > 1 ? "s" : ""}</small></> : null}</td><td>{b.table_no ?? <span className="muted">any</span>}</td><td>{b.phone}</td><td>{b.note}{b.preorder && <><br /><small>🍽 {b.preorder}{b.preorder_code && b.preorder_code !== "placing" ? <span className="muted"> · {["failed", "missed"].includes(b.preorder_code) ? b.preorder_code : `sent as ${b.preorder_code}`}</span> : <span className="muted"> · goes to the kitchen 15 min before</span>}</small></>}</td>
                    <td><span className="status-tag">{b.status === "pending" ? "awaiting deposit" : b.status}</span>{b.deposit ? <><br /><small className={b.deposit_status === "paid" ? "success" : "muted"}>{rupees(b.deposit)} deposit {b.deposit_status === "paid" ? "paid" : b.deposit_status === "kept" ? "kept" : "due"}</small></> : null}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {b.status === "confirmed" && <>
                        <button className="chip" onClick={() => setBooking(b, "seated")}>Seat</button>{" "}
                        <button className="chip" onClick={() => setBooking(b, "cancelled")}>Cancel</button>{" "}
                        {b.date <= new Date().toISOString().slice(0, 10) && <button className="chip" onClick={() => setBooking(b, "no-show")} title={b.deposit_status === "paid" ? "They didn't come: keep the deposit" : "They didn't come"}>No-show</button>}
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {waitlist.length > 0 && (
            <>
              <h3 style={{ margin: "1.5rem 0 0.5rem" }}>⏳ Waitlist</h3>
              <p className="small muted">When you cancel a booking, the first person waiting for that time gets an email automatically.</p>
              <table className="table">
                <thead><tr><th>Date</th><th>Time</th><th>Name</th><th>Guests</th><th>Phone</th><th>Email</th></tr></thead>
                <tbody>
                  {waitlist.map((w) => (
                    <tr key={w.id}><td>{w.date}</td><td>{w.time}</td><td>{w.name}</td><td>{w.guests}</td><td>{w.phone}</td><td>{w.email}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
      {tab === "Bookings" && <><ShelfCard /><ScoreboardCard />{me?.role === "owner" && <BlindDateCard />}</>}

      {tab === "Settings" && me?.role === "owner" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <p className="small muted" style={{ margin: 0 }}>New here? Read the <a href="/help/owner" target="_blank">owner guide</a>, and print the <a href="/help/barista" target="_blank">barista guide</a> for the counter.</p>
          <HoursEditor />
          <BranchesCard />
          <DeliveryZonesCard />
          <LinksCard />
          <GmailConnect />
          <GstCard />
          <WifiCard />
          <OwnerAlertsCard />
          <OwnerEmails />
          <ImportCard />
          <Backups />
          <TwoStep />
          <SimCard />
          <DemoResetCard />
        </div>
      )}
      {tab === "Menu" && <><ComebackCard canEdit={me?.role === "owner"} />{me?.role === "owner" && <><MenuTidyCard /><RotationCard /><SpecialsCard /><CombosCard /></>}<MenuEditor canEdit={me?.role === "owner"} /></>}
      {tab === "Analytics" && me?.role === "owner" && <><MonthlyCard /><InsightsCard kind="business" /><VisitorsPanel /><RetentionPanel /><ProfitPanel /><MenuEngineering /><MissedSales /><PriceWhatIf /><Analytics /></>}
      {tab === "Games" && me?.role === "owner" && <><GamesDashboard /><GoaSpotsCard /></>}
      {tab === "Team" && me?.role === "owner" && <Team />}
      {tab === "Team" && me?.role === "owner" && <><ThanksNotes showEmpty /><TeamProfiles /></>}
      {tab === "Stock" && <><UseByCard />{me?.role === "owner" && <PriceWatch />}<StockTab canEdit={me?.role === "owner"} /></>}
      {tab === "Tables & QR" && <><TableTagsCard canEdit={me?.role === "owner"} /><TablesQR /></>}
      {tab === "Events" && <><BookClubCard canEdit={me?.role === "owner"} />{me?.role === "owner" && <GameNightCard />}<EventsTab canEdit={me?.role === "owner"} />{me?.role === "owner" && <><ArtCard /><AdoptCard /></>}</>}
      {tab === "Waste" && <WasteTab />}
      {tab === "Cash-up" && <CashupTab />}
      {tab === "Cakes" && <CakesTab />}
      {tab === "Checklists" && <ChecklistsTab canEdit={me?.role === "owner"} />}
      {tab === "Catering" && me?.role === "owner" && <CateringTab />}
      {tab === "Companies" && me?.role === "owner" && <CompaniesTab />}
      {tab === "P&L" && me?.role === "owner" && <PnlTab />}
      {tab === "Notices" && <><ApprovalQueue />{me?.role === "owner" && <><ComingSoonCard /><GoaEventsCard /></>}<QuizCard /><ShoutoutsCard /><AskCard /><LostFoundCard /><LatteArtCard me={me ?? null} /><StoryChainCard /><KindNotesCard /><GuestRecipesCard />{me?.role === "owner" && <Connect4Card />}{me?.role === "owner" && <ISpyCard />}<PollCard /><StoriesCard /><WishesCard /><NoticesTab /><NearbyCard canEdit={me?.role === "owner"} /></>}
      {tab === "Newsletter" && me?.role === "owner" && <NewsletterTab />}
      {tab === "Guests" && me?.role === "owner" && <><WinbackCard /><GuestsTab /></>}
      {tab === "Journal" && me?.role === "owner" && <><RecipeWeekCard /><JournalTab /></>}
      {tab === "Rota" && <RotaTab canEdit={me?.role === "owner"} />}
      {tab === "Training" && <TrainingTab canEdit={me?.role === "owner"} />}
      {tab === "Health" && me?.role === "owner" && <HealthTab />}
      {tab === "Promos" && me?.role === "owner" && <PromosTab />}
      {tab === "Promos" && me?.role === "owner" && <p className="small muted" style={{ marginTop: "0.8rem" }}>🎄 The advent calendar makes 24 one-day codes (ADVENT + year + day) automatically. <a href="/advent?preview=1" target="_blank" rel="noreferrer">Preview every door ↗</a></p>}

      {tab === "Gift cards" && (
        <div className="card table-wrap" style={{ padding: "1rem" }}>
          {!gifts.length ? <p className="muted">No gift cards yet.</p> : (
            <table className="table">
              <thead><tr><th>Code</th><th>From → To</th><th>Amount</th><th>Balance</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>
                {gifts.map((g) => (
                  <tr key={g.code}>
                    <td><code>{g.code}</code></td><td>{g.from_name} → {g.to_name}<br /><small className="muted">{g.to_email}</small></td>
                    <td>{rupees(g.amount)}</td><td>{rupees(g.balance)}</td>
                    <td><span className={`status-tag ${g.paid ? "paid" : "pending"}`}>{g.paid ? "active" : "unpaid"}</span></td>
                    <td>{g.created_at.slice(0, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "Emails" && mail && (
        <>
          <p className="muted" style={{ marginBottom: "1rem" }}>
            {mail.emailProvider === "gmail-api" || mail.emailProvider === "gmail"
              ? `Emails are being sent as “Moss & Moon” from ${mail.emailFrom}, to any address guests type in.`
              : mail.emailMode === "live"
              ? "Emails are being sent through Resend. Without your own domain, Resend only delivers to the address you signed up with (see DEPLOY.md to send to everyone)."
              : "Emails are saved here but not sent yet. Add a RESEND_API_KEY to start sending them (see DEPLOY.md)."}
          </p>
          <div className="email-layout">
            <div className="card" style={{ padding: "0.5rem" }}>
              {!mail.emails.length && <p className="muted" style={{ padding: "1rem" }}>No emails yet.</p>}
              {mail.emails.map((e) => (
                <button key={e.id} className={`email-row ${preview?.id === e.id ? "on" : ""}`} onClick={() => setPreview(e)}>
                  <strong>{e.subject}</strong>
                  <small className="muted">{e.to_email} · {e.created_at.slice(5, 16)} · <span className={e.status === "failed" ? "error" : ""}>{e.status}</span></small>
                </button>
              ))}
            </div>
            <div className="card email-preview">
              {preview ? <iframe title="Email preview" srcDoc={preview.html} sandbox="" /> : <p className="muted" style={{ padding: "1.5rem" }}>Pick an email to preview it.</p>}
              {preview?.error && <p className="error small" style={{ padding: "0 1rem 1rem" }}>{preview.error}</p>}
            </div>
          </div>
        </>
      )}

      {tab === "Reviews" && <PhotosCard />}
      {tab === "Reviews" && <InsightsCard kind="reviews" />}
      {tab === "Reviews" && (
        <div className="reviews" style={{ marginTop: 0 }}>
          {reviews.map((r) => (
            <article key={r.id} className="review card">
              <span className="stars">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
              <p style={{ fontSize: "1.05rem" }}>“{r.text}”</p>
              <footer style={{ justifyContent: "space-between" }}>
                <span>{r.name} · {r.created_at.slice(0, 10)}{r.private ? <span className="branch-tag" title="Only you can see this one">🔒 private</span> : null}</span>
                <button className="chip" onClick={() => deleteReview(r.id)}>Remove</button>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
