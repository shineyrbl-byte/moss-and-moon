"use client";
// Handles "Pay online": opens Razorpay when it's set up, otherwise a
// clearly-labelled demo payment screen so the whole flow can be tried safely.
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { rupees } from "@/lib/pricing";

type Kind = "order" | "giftcard" | "share" | "pass" | "ticket" | "drinkgift" | "catering" | "wallet" | "booking" | "cake" | "tab";
type Start =
  | { mode: "demo"; amount: number; label: string; code: string; kind: Kind; shareId?: number }
  | { mode: "razorpay"; amount: number; label: string; code: string; kind: Kind; keyId: string; orderId: string; shareId?: number };

type PayFn = (kind: Kind, code: string, prefill?: { name?: string; email?: string; phone?: string }, extra?: Record<string, unknown>) => Promise<boolean>;
const Ctx = createContext<PayFn | null>(null);

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, fn: () => void) => void };
  }
}

function loadRazorpay() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const verify = (body: Record<string, unknown>) =>
  fetch("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.ok);

export function PaymentProvider({ children }: { children: React.ReactNode }) {
  const [demo, setDemo] = useState<Start | null>(null);
  const [error, setError] = useState("");
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const pay = useCallback<PayFn>(async (kind, code, prefill = {}, extra = {}) => {
    setError("");
    const r = await fetch("/api/payments/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...extra, kind, code }) });
    const start = (await r.json()) as Start & { error?: string };
    if (!r.ok) {
      alertLater(start.error ?? "Payment couldn't start.");
      return false;
    }

    if (start.mode === "razorpay") {
      if (!(await loadRazorpay()) || !window.Razorpay) {
        alertLater("Couldn't load the payment window. Check your connection?");
        return false;
      }
      return new Promise<boolean>((resolve) => {
        const rz = new window.Razorpay!({
          key: start.keyId,
          order_id: start.orderId,
          amount: start.amount * 100,
          currency: "INR",
          name: "Moss & Moon",
          description: start.label,
          prefill: { name: prefill.name, email: prefill.email, contact: prefill.phone },
          theme: { color: "#c25b78" },
          handler: async (resp: Record<string, string>) => resolve(await verify({ kind, code, shareId: start.shareId, ...resp })),
          modal: { ondismiss: () => resolve(false) },
        });
        rz.open();
      });
    }

    // Demo mode
    setDemo(start);
    return new Promise<boolean>((resolve) => (resolver.current = resolve));
  }, []);

  function finish(ok: boolean) {
    resolver.current?.(ok);
    resolver.current = null;
    setDemo(null);
  }

  return (
    <Ctx.Provider value={pay}>
      {children}
      {demo && <DemoPay start={demo} onDone={finish} error={error} setError={setError} />}
    </Ctx.Provider>
  );
}

// Errors before the modal opens are shown with a small floating note
function alertLater(msg: string) {
  const el = document.createElement("div");
  el.className = "toast";
  el.style.cssText = "position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);z-index:300";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

export const usePay = () => {
  const p = useContext(Ctx);
  if (!p) throw new Error("usePay must be inside PaymentProvider");
  return p;
};

function DemoPay({ start, onDone, error, setError }: { start: Start; onDone: (ok: boolean) => void; error: string; setError: (s: string) => void }) {
  const [tab, setTab] = useState<"upi" | "card">("upi");
  const [stage, setStage] = useState<"form" | "paying" | "done">("form");

  async function go() {
    setStage("paying");
    await new Promise((r) => setTimeout(r, 1300));
    const ok = await verify({ kind: start.kind, code: start.code, shareId: start.shareId, demo: true });
    if (!ok) {
      setStage("form");
      return setError("Payment didn't go through. Try again?");
    }
    setStage("done");
    setTimeout(() => onDone(true), 1100);
  }

  return (
    <>
      <div className="overlay show" style={{ zIndex: 140 }} onClick={() => stage === "form" && onDone(false)} />
      <div className="modal card pay-modal" style={{ zIndex: 150 }} role="dialog" aria-modal="true" aria-label="Payment">
        <div className="pay-test">🧪 Test mode: no real money moves. Add Razorpay keys to take real payments.</div>
        {stage === "done" ? (
          <div className="confirm" style={{ padding: "2.5rem 1.5rem" }}>
            <span className="pay-check">✓</span>
            <h3>Paid {rupees(start.amount)}</h3>
            <p className="muted">Thank you ✿</p>
          </div>
        ) : (
          <div className="modal-body">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>{start.label}</p>
                <h3 style={{ fontSize: "2.2rem" }}>{rupees(start.amount)}</h3>
              </div>
              <button className="icon-btn" onClick={() => onDone(false)} disabled={stage === "paying"} aria-label="Cancel payment">✕</button>
            </div>
            <div className="chips" style={{ justifyContent: "flex-start" }}>
              <button className={`chip ${tab === "upi" ? "on" : ""}`} onClick={() => setTab("upi")}>UPI</button>
              <button className={`chip ${tab === "card" ? "on" : ""}`} onClick={() => setTab("card")}>Card</button>
            </div>
            {tab === "upi" ? (
              <label className="field">UPI ID<input className="input" defaultValue="mossandmoon@okdemo" /></label>
            ) : (
              <>
                <label className="field">Card number<input className="input" defaultValue="4111 1111 1111 1111" /></label>
                <div className="row">
                  <label className="field">Expiry<input className="input" defaultValue="12/30" /></label>
                  <label className="field">CVV<input className="input" defaultValue="123" /></label>
                </div>
              </>
            )}
            {error && <p className="error small">{error}</p>}
            <button className="btn btn-pink full" onClick={go} disabled={stage === "paying"}>
              {stage === "paying" ? <span className="spinner" /> : `Pay ${rupees(start.amount)}`}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
