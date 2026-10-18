// SQLite database, built into Node (no install needed).
// Saved in data/cafe.db, or in DATA_DIR if that's set (used when hosting online).
import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { MENU_V2, SEED_MENU } from "./menu";
import { SEASONAL_ITEMS } from "./seasons";
import { DEFAULT_PROMOS } from "./pricing";
import { NUTRITION } from "./nutrition";
import { SEED_EVENTS } from "./cafe";

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
    CREATE TABLE IF NOT EXISTS groups (
      code TEXT PRIMARY KEY,
      host_name TEXT NOT NULL,
      host_token TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      order_code TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS group_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_code TEXT NOT NULL,
      person TEXT NOT NULL,
      item_id TEXT NOT NULL,
      opts TEXT NOT NULL,
      qty INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS tickets (
      code TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      qty INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      paid INTEGER NOT NULL DEFAULT 0,
      payment_ref TEXT,
      checked_in INTEGER NOT NULL DEFAULT 0,
      checked_in_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      start TEXT NOT NULL,
      end TEXT NOT NULL,
      note TEXT
    );
    CREATE TABLE IF NOT EXISTS error_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signature TEXT UNIQUE NOT NULL,
      source TEXT NOT NULL,
      message TEXT NOT NULL,
      detail TEXT,
      count INTEGER NOT NULL DEFAULT 1,
      alerted_at TEXT,
      first_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      last_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS promos (
      code TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      value INTEGER NOT NULL,
      min_order INTEGER NOT NULL DEFAULT 0,
      max_uses INTEGER,
      uses INTEGER NOT NULL DEFAULT 0,
      once_per_guest INTEGER NOT NULL DEFAULT 0,
      starts TEXT,
      expires TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS drink_gifts (
      code TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      opts TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      amount INTEGER NOT NULL,
      from_name TEXT NOT NULL,
      from_email TEXT,
      to_name TEXT NOT NULL,
      to_email TEXT,
      message TEXT,
      paid INTEGER NOT NULL DEFAULT 0,
      payment_ref TEXT,
      order_code TEXT,
      redeemed_at TEXT,
      expires TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS waste (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL,
      item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      qty INTEGER NOT NULL,
      reason TEXT NOT NULL DEFAULT 'leftover',
      cost REAL NOT NULL DEFAULT 0,
      staff_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      lines TEXT NOT NULL,
      days TEXT NOT NULL,
      time TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      skip_date TEXT,
      last_date TEXT,
      last_order TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      text TEXT NOT NULL,
      contact TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      ip_hash TEXT,
      expires TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS visits (
      day TEXT NOT NULL,
      vid TEXT NOT NULL,
      device TEXT NOT NULL,
      PRIMARY KEY (day, vid)
    );
    CREATE TABLE IF NOT EXISTS page_views (
      day TEXT NOT NULL,
      path TEXT NOT NULL,
      ref TEXT NOT NULL DEFAULT '',
      n INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, path, ref)
    );
    CREATE TABLE IF NOT EXISTS payment_intents (
      rzp_order_id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      code TEXT NOT NULL,
      share_id INTEGER,
      amount INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
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
  addColumn(db, "orders", "refund_amount", "INTEGER NOT NULL DEFAULT 0");
  addColumn(db, "orders", "refund_ref", "TEXT");
  addColumn(db, "orders", "refunded_at", "TEXT");
  addColumn(db, "orders", "group_code", "TEXT");
  addColumn(db, "order_payments", "person", "TEXT");
  addColumn(db, "orders", "review_asked", "INTEGER NOT NULL DEFAULT 0"); // 1 = asked, 2 = skipped
  addColumn(db, "reviews", "order_code", "TEXT"); // set when the review came from a real order
  addColumn(db, "ingredients", "cost", "REAL"); // ₹ per g / ml / piece
  addColumn(db, "customers", "badges", "TEXT"); // badges already shown to them
  addColumn(db, "orders", "collected_at", "TEXT");
  addColumn(db, "orders", "pickup_reminded", "INTEGER NOT NULL DEFAULT 0");
  addColumn(db, "bookings", "reminded", "INTEGER NOT NULL DEFAULT 0");

  // First run: copy the starting menu into the database
  const items = db.prepare("SELECT COUNT(*) AS n FROM menu_items").get() as { n: number };
  if (items.n === 0) {
    const add = db.prepare("INSERT INTO menu_items (id, data, sort) VALUES (?, ?, ?)");
    SEED_MENU.forEach((m, i) => add.run(m.id, JSON.stringify(m), i * 10));
  }

  // Starting promo codes (only the first time)
  if (!db.prepare("SELECT value FROM settings WHERE key = 'seeded_promos'").get()) {
    const add = db.prepare("INSERT OR IGNORE INTO promos (code, kind, value, min_order, once_per_guest) VALUES (?, ?, ?, ?, ?)");
    for (const p of DEFAULT_PROMOS) add.run(p.code, p.kind, p.value, p.minOrder, p.code === "FIRSTSIP" ? 1 : 0);
    db.prepare("INSERT INTO settings (key, value) VALUES ('seeded_promos', '1')").run();
  }

  // Seasonal specials: added once, so an owner who deletes one doesn't get it back
  const seeded = db.prepare("SELECT value FROM settings WHERE key = 'seeded_seasonal'").get();
  if (!seeded) {
    const add = db.prepare("INSERT OR IGNORE INTO menu_items (id, data, sort) VALUES (?, ?, ?)");
    SEASONAL_ITEMS.forEach((m, i) => add.run(m.id, JSON.stringify(m), -40 + i)); // shown first while in season
    db.prepare("INSERT INTO settings (key, value) VALUES ('seeded_seasonal', '1')").run();
  }

  // October 2026 menu update: cold drinks and food, added once to existing cafés
  if (!db.prepare("SELECT value FROM settings WHERE key = 'seeded_menu_v2'").get()) {
    const last = (db.prepare("SELECT COALESCE(MAX(sort), 0) AS s FROM menu_items").get() as { s: number }).s;
    const add = db.prepare("INSERT OR IGNORE INTO menu_items (id, data, sort) VALUES (?, ?, ?)");
    MENU_V2.forEach((m, i) => add.run(m.id, JSON.stringify(m), last + 10 + i * 10));
    db.prepare("INSERT INTO settings (key, value) VALUES ('seeded_menu_v2', '1')").run();
  }

  // Events: the starting ones, once (then owners manage them in Admin → Events)
  if (!db.prepare("SELECT value FROM settings WHERE key = 'seeded_events'").get()) {
    const add = db.prepare("INSERT OR IGNORE INTO events (id, data) VALUES (?, ?)");
    for (const e of SEED_EVENTS) add.run(e.id, JSON.stringify(e));
    db.prepare("INSERT INTO settings (key, value) VALUES ('seeded_events', '1')").run();
  }

  // Allergens & calories for the starting menu (once; items an owner already set are left alone)
  if (!db.prepare("SELECT value FROM settings WHERE key = 'seeded_nutrition'").get()) {
    const rows = db.prepare("SELECT id, data FROM menu_items").all() as { id: string; data: string }[];
    const upd = db.prepare("UPDATE menu_items SET data = ? WHERE id = ?");
    for (const r of rows) {
      const n = NUTRITION[r.id];
      const d = JSON.parse(r.data);
      if (!n || d.allergens || d.kcal !== undefined) continue;
      upd.run(JSON.stringify({ ...d, allergens: n.allergens, kcal: n.kcal }), r.id);
    }
    db.prepare("INSERT INTO settings (key, value) VALUES ('seeded_nutrition', '1')").run();
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

/** Close the database so its file can be swapped (used when restoring a backup). It reopens on next use. */
export function closeDb() {
  try { g.__cafeDb?.close(); } catch {}
  g.__cafeDb = undefined;
}

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
