// Monthly profit & loss: sales, cost of what was sold, waste and the owner's expenses
import "server-only";
import { db } from "./db";
import { costTable, orderCost } from "./profit";
import { menuLookup } from "./menuStore";
import type { QuoteLine } from "./pricing";

export const EXPENSE_CATEGORIES = ["rent", "wages", "utilities", "supplies", "marketing", "repairs", "other"] as const;
export type Expense = { id: number; month: string; category: string; label: string; amount: number; recurring: number };

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const validMonth = (m: unknown): m is string => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

/** Expenses that count for a month: ones logged for it, plus repeating ones started on or before it */
export function expensesFor(month: string) {
  return db.prepare("SELECT id, month, category, label, amount, recurring FROM expenses WHERE month = ? OR (recurring = 1 AND month < ?) ORDER BY category, id").all(month, month) as Expense[];
}

export function monthPnl(month: string) {
  const find = menuLookup();
  const costs = costTable();
  const orders = db.prepare("SELECT lines, total, refund_amount FROM orders WHERE strftime('%Y-%m', created_at) = ? AND status != 'cancelled'").all(month) as { lines: string; total: number; refund_amount: number }[];
  let sales = 0, cogs = 0;
  for (const o of orders) {
    sales += o.total - (o.refund_amount ?? 0);
    cogs += orderCost(JSON.parse(o.lines) as QuoteLine[], find, costs);
  }
  const one = (sql: string) => (db.prepare(sql).get(month) as { a: number }).a;
  const tickets = one("SELECT COALESCE(SUM(amount), 0) AS a FROM tickets WHERE paid = 1 AND strftime('%Y-%m', created_at) = ?");
  const catering = tableExists("catering") ? one("SELECT COALESCE(SUM(amount), 0) AS a FROM catering WHERE status IN ('paid','done') AND strftime('%Y-%m', paid_at) = ?") : 0;
  const cakes = tableExists("cake_orders") ? one("SELECT COALESCE(SUM(price), 0) AS a FROM cake_orders WHERE status IN ('paid','ready','collected') AND substr(pickup_date, 1, 7) = ?") : 0;
  const waste = one("SELECT COALESCE(SUM(cost), 0) AS a FROM waste WHERE substr(day, 1, 7) = ?");
  const expenses = expensesFor(month);
  const byCategory: Record<string, number> = {};
  for (const e of expenses) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const revenue = sales + tickets + catering + cakes;
  const gross = revenue - cogs - waste;
  const net = gross - expenseTotal;
  const r = Math.round;
  return {
    month, orders: orders.length,
    sales: r(sales), tickets: r(tickets), catering: r(catering), cakes: r(cakes), revenue: r(revenue),
    cogs: r(cogs), waste: r(waste), gross: r(gross),
    expenses: r(expenseTotal), byCategory, expenseList: expenses,
    net: r(net), margin: revenue ? Math.round((net / revenue) * 100) : 0,
  };
}

function tableExists(name: string) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
}

/** The last n months, oldest first */
export function pnlMonths(n = 6, now = new Date()) {
  return Array.from({ length: n }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1)));
}
