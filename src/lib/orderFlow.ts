import { db, getSetting, setSetting } from "@/lib/db";
import { DEMO_TIMES, ORDER_STEPS, demoStatus, type OrderStatus } from "@/lib/cafe";

export { DEMO_TIMES };
import { orderReadyEmail, receiptEmail, sendLater } from "@/lib/email";
import { receiptPdf, type ReceiptOrder } from "@/lib/receipt";
import { notifyOrder } from "@/lib/push";
import { publish } from "@/lib/live";

/** Move an order to a new status, with the emails, push and live updates that go with it. */
export function setOrderStatus(code: string, status: OrderStatus, staffId?: number) {
  const r = db.prepare("UPDATE orders SET status = ? WHERE code = ?").run(status, code);
  if (!r.changes) return false;
  if (status === "brewing" && staffId) db.prepare("UPDATE orders SET staff_id = ? WHERE code = ?").run(staffId, code);
  publish({ type: "order", code, status, action: "status" });

  if (status === "ready") {
    db.prepare("UPDATE orders SET ready_at = datetime('now','localtime') WHERE code = ?").run(code);
    const o = db.prepare("SELECT code, name, email, table_no, delivery_address FROM orders WHERE code = ?").get(code) as {
      code: string; name: string; email: string | null; table_no: number | null; delivery_address: string | null;
    };
    if (o.email) sendLater(o.email, ...orderReadyEmail(o));
    void notifyOrder(o.code, {
      title: o.table_no ? "Your order is on its way 🌸" : "Your order is ready 🌸",
      body: o.table_no ? `${o.code} — we're bringing it to table ${o.table_no} now.` : `${o.code} — come grab it from the pink counter.`,
      url: `/order/${o.code}`,
    });
  }
  // Collected + paying at the counter = paid
  if (status === "collected") {
    db.prepare("UPDATE orders SET pay_status = 'paid', collected_at = COALESCE(collected_at, datetime('now','localtime')) WHERE code = ? AND pay_status = 'unpaid' AND pay_method != 'company'").run(code);
    db.prepare("UPDATE orders SET collected_at = COALESCE(collected_at, datetime('now','localtime')) WHERE code = ?").run(code);
    void emailReceipt(code);
  }
  return true;
}

/** Email the PDF receipt once the order is collected */
async function emailReceipt(code: string) {
  try {
    const row = db
      .prepare(
        `SELECT code, name, email, created_at, lines, subtotal, discount, total, promo, giftcard_used, credit_used, tip, delivery_fee, refund_amount,
                pay_method, pay_status, table_no, delivery_address, pickup FROM orders WHERE code = ?`
      )
      .get(code) as (Omit<ReceiptOrder, "lines"> & { lines: string; email: string | null }) | undefined;
    if (!row?.email) return;
    const pdf = await receiptPdf({ ...row, lines: JSON.parse(row.lines) });
    sendLater(row.email, ...receiptEmail(row), [{ filename: `moss-and-moon-${code}.pdf`, content: pdf }]);
  } catch (e) {
    console.error("Receipt email failed", e);
  }
}

// ---------- Demo barista ----------
// With no staff working (e.g. a portfolio demo), orders move along by themselves.
// Owners can switch it off in the admin Overview once real staff run the counter.

export function demoBaristaOn() {
  const saved = getSetting("demo_barista");
  if (saved) return saved === "on";
  return process.env.DEMO_BARISTA !== "off";
}
export function setDemoBarista(on: boolean) {
  setSetting("demo_barista", on ? "on" : "off");
}

export function demoTick(now = new Date()) {
  if (!demoBaristaOn()) return 0;
  const rows = db
    .prepare("SELECT code, status, pickup, created_at, delivery_address FROM orders WHERE status != 'collected' AND created_at >= datetime('now','localtime','-1 day')")
    .all() as { code: string; status: OrderStatus; pickup: string; created_at: string; delivery_address: string | null }[];
  let moved = 0;
  for (const o of rows) {
    let start = new Date(o.created_at.replace(" ", "T"));
    // Scheduled pickups start brewing a few minutes before the chosen time
    const m = /^(\d{2}):(\d{2})$/.exec(o.pickup);
    if (m) {
      const due = new Date(start);
      due.setHours(Number(m[1]), Number(m[2]) - DEMO_TIMES.ready, 0, 0);
      if (due > start) start = due;
    }
    const target = demoStatus((now.getTime() - start.getTime()) / 60000, !!o.delivery_address);
    // Step through each status so "ready" emails and notifications still go out
    for (let i = ORDER_STEPS.indexOf(o.status) + 1; i <= ORDER_STEPS.indexOf(target); i++) {
      setOrderStatus(o.code, ORDER_STEPS[i]);
      moved++;
    }
  }
  return moved;
}


