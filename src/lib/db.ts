// SQLite database, built into Node (no install needed).
// Saved in data/cafe.db, or in DATA_DIR if that's set (used when hosting online).
import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const g = globalThis as unknown as { __cafeDb?: DatabaseSync };

/** Add a column to an existing table if it isn't there yet (for older databases). */
function addColumn(db: DatabaseSync, table: string, column: string, type: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

function open() {
  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "cafe.db"));
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
  addColumn(db, "bookings", "email", "TEXT");

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

export const db = g.__cafeDb ?? (g.__cafeDb = open());

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
