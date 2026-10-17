// SQLite database, built into Node (no install needed).
// Saved in data/cafe.db, or in DATA_DIR if that's set (used when hosting online).
import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { SEED_MENU } from "./menu";

const g = globalThis as unknown as { __cafeDb?: DatabaseSync };

/** Add a column to an existing table if it isn't there yet (for older databases). */
function addColumn(db: DatabaseSync, table: string, column: string, type: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

/** Folder where the database and uploaded photos live */
export const dataDir = () => process.env.DATA_DIR || path.join(process.cwd(), "data");

function open() {
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  // Wait up to 5s if another process is using the database, instead of failing
  const db = new DatabaseSync(path.join(dir, "cafe.db"), { timeout: 5000 });
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      pickup TEXT NOT NULL,
      note TEXT,
      lines TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      discount INTEGER NOT NULL,
      total INTEGER NOT NULL,
      promo TEXT,
      status TEXT NOT NULL DEFAULT 'received',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      guests INTEGER NOT NULL,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      rating INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS loyalty (
      phone TEXT PRIMARY KEY,
      name TEXT,
      stamps INTEGER NOT NULL DEFAULT 0,
      rewards_used INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS subscribers (
      email TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS rsvps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      UNIQUE(event_id, email)
    );
    CREATE TABLE IF NOT EXISTS sold_out (
      item_id TEXT PRIMARY KEY
    );
    CREATE TABLE IF NOT EXISTS giftcards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      amount INTEGER NOT NULL,
      balance INTEGER NOT NULL,
      from_name TEXT NOT NULL,
      to_name TEXT NOT NULL,
      to_email TEXT NOT NULL,
      message TEXT,
      design TEXT NOT NULL DEFAULT 'blush',
      paid INTEGER NOT NULL DEFAULT 0,
      payment_ref TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      sort INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS push_subs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_code TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE(order_code, endpoint)
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      phone TEXT,
      birthday TEXT,
      favs TEXT NOT NULL DEFAULT '[]',
      referral_code TEXT UNIQUE,
      referred_by INTEGER,
      credit INTEGER NOT NULL DEFAULT 0,
      birthday_treat_year INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS login_codes (
      email TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      sent_count INTEGER NOT NULL DEFAULT 0,
      window_start INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS customer_sessions (
      token_hash TEXT PRIMARY KEY,
      customer_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS table_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_no INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      done_at TEXT
    );
    CREATE TABLE IF NOT EXISTS order_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_code TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      ref TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS passes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      starts TEXT NOT NULL,
      ends TEXT NOT NULL,
      price INTEGER NOT NULL,
      paid INTEGER NOT NULL DEFAULT 0,
      payment_ref TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS pass_uses (
      customer_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      order_code TEXT NOT NULL,
      PRIMARY KEY (customer_id, day)
    );
    CREATE TABLE IF NOT EXISTS waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      guests INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'barista',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS ingredients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      qty REAL NOT NULL DEFAULT 0,
      low_at REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      html TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);

  // Newer columns (added safely to databases created by older versions)
  addColumn(db, "orders", "email", "TEXT");
  addColumn(db, "orders", "pay_method", "TEXT NOT NULL DEFAULT 'counter'"); // counter | online
  addColumn(db, "orders", "pay_status", "TEXT NOT NULL DEFAULT 'unpaid'"); // unpaid | pending | paid
  addColumn(db, "orders", "payment_ref", "TEXT");
  addColumn(db, "orders", "giftcard_code", "TEXT");
  addColumn(db, "orders", "giftcard_used", "INTEGER NOT NULL DEFAULT 0");
  addColumn(db, "orders", "happy_hour", "INTEGER NOT NULL DEFAULT 0");
  addColumn(db, "orders", "table_no", "INTEGER");
  addColumn(db, "orders", "ready_at", "TEXT");
  addColumn(db, "bookings", "email", "TEXT");
  addColumn(db, "orders", "customer_id", "INTEGER");
  addColumn(db, "orders", "tip", "INTEGER NOT NULL DEFAULT 0");
  addColumn(db, "orders", "credit_used", "INTEGER NOT NULL DEFAULT 0");
  addColumn(db, "orders", "delivery_fee", "INTEGER NOT NULL DEFAULT 0");
  addColumn(db, "orders", "delivery_address", "TEXT");
  addColumn(db, "orders", "split_count", "INTEGER");
  addColumn(db, "orders", "perks", "TEXT"); // e.g. "pass,birthday"
  addColumn(db, "orders", "staff_id", "INTEGER");
  addColumn(db, "reviews", "photo", "TEXT");

  // First run: copy the starting menu into the database
  const items = db.prepare("SELECT COUNT(*) AS n FROM menu_items").get() as { n: number };
  if (items.n === 0) {
    const add = db.prepare("INSERT INTO menu_items (id, data, sort) VALUES (?, ?, ?)");
    SEED_MENU.forEach((m, i) => add.run(m.id, JSON.stringify(m), i * 10));
  }

  const count = db.prepare("SELECT COUNT(*) AS n FROM reviews").get() as { n: number };
  if (count.n === 0) {
    const add = db.prepare("INSERT INTO reviews (name, rating, text) VALUES (?, ?, ?)");
    add.run("Ananya", 5, "The rose pistachio latte is unreal. Also the prettiest café I've ever studied in 🌸");
    add.run("Kabir", 5, "Came for the croissant, stayed four hours. The window seat is perfect.");
    add.run("Meera", 4, "Matcha is properly whisked, not powdery. Gets busy on Saturdays though!");
    add.run("Rohan", 5, "Open mic night was so cosy. Staff remembered my order the second time.");
  }
  return db;
}

const getDb = () => (g.__cafeDb ??= open());

// Opens the database the first time it's actually used (not when the code
// loads), so building the site never touches it.
export const db = new Proxy({} as DatabaseSync, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** Short readable code like "MM-7KQ2" */
export function makeCode(prefix: string, length = 4) {
  let s = "";
  for (let i = 0; i < length; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return `${prefix}-${s}`;
}

export const cleanPhone = (p: unknown) => String(p ?? "").replace(/\D/g, "").slice(-10);
export const cleanText = (t: unknown, max: number) => String(t ?? "").trim().slice(0, max);
export const cleanEmail = (e: unknown) => {
  const s = cleanText(e, 100).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : "";
};

/** Small key/value store for settings the app creates itself */
export function getSetting(key: string) {
  return (db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined)?.value;
}
export function setSetting(key: string, value: string) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
