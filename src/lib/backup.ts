// Database backups: a fresh copy every night (kept for 14 days), emailed to the
// owner every Sunday, downloadable any time, and restorable from the admin page.
import "server-only";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import { closeDb, dataDir, db, getSetting, setSetting } from "./db";
import { toDateStr } from "./cafe";
import { ownerEmail, ownerPref } from "./owner";
import { sendEmail } from "./email";

const KEEP = 14;
const EMAIL_LIMIT = 30 * 1024 * 1024; // Resend allows ~40 MB per email
export const backupDir = () => path.join(dataDir(), "backups");
const stamp = (d = new Date()) => `${toDateStr(d)}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;

/** A consistent snapshot of the live database, gzipped */
export function makeBackup(label = "") {
  fs.mkdirSync(backupDir(), { recursive: true });
  const tmp = path.join(backupDir(), `.tmp-${process.pid}-${Date.now()}.db`);
  db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`); // safe copy even while the café is busy
  const name = `cafe-${stamp()}${label ? `-${label}` : ""}.db.gz`;
  const file = path.join(backupDir(), name);
  fs.writeFileSync(file, zlib.gzipSync(fs.readFileSync(tmp), { level: 9 }));
  fs.rmSync(tmp, { force: true });
  prune();
  return { name, file, size: fs.statSync(file).size };
}

function prune() {
  const all = listBackups();
  for (const b of all.slice(KEEP)) fs.rmSync(path.join(backupDir(), b.name), { force: true });
}

export function listBackups() {
  if (!fs.existsSync(backupDir())) return [];
  return fs
    .readdirSync(backupDir())
    .filter((f) => /^cafe-[\w-]+\.db\.gz$/.test(f))
    .map((name) => {
      const st = fs.statSync(path.join(backupDir(), name));
      return { name, size: st.size, at: st.mtime.toISOString() };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** A backup file by name (no paths allowed) */
export function backupFile(name: string) {
  if (!/^cafe-[\w-]+\.db\.gz$/.test(name)) return null;
  const file = path.join(backupDir(), name);
  return fs.existsSync(file) ? file : null;
}

/**
 * Replace the live database with an uploaded backup (.db or .db.gz).
 * The current database is backed up first, so a restore can always be undone.
 */
export function restoreBackup(bytes: Buffer) {
  let raw = bytes;
  if (raw[0] === 0x1f && raw[1] === 0x8b) raw = zlib.gunzipSync(raw);
  if (raw.subarray(0, 16).toString("latin1") !== "SQLite format 3\0") throw new Error("That isn't a Moss & Moon backup file.");

  fs.mkdirSync(backupDir(), { recursive: true });
  const candidate = path.join(backupDir(), `.restore-${Date.now()}.db`);
  fs.writeFileSync(candidate, raw);
  try {
    const check = new DatabaseSync(candidate, { readOnly: true });
    const ok = (check.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check === "ok";
    const tables = (check.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((t) => t.name);
    check.close();
    if (!ok || !tables.includes("orders") || !tables.includes("menu_items")) throw new Error("That backup looks damaged or isn't from this café.");
  } catch (e) {
    fs.rmSync(candidate, { force: true });
    throw e;
  }

  const before = makeBackup("before-restore");
  closeDb();
  const live = path.join(dataDir(), "cafe.db");
  for (const ext of ["-wal", "-shm"]) fs.rmSync(live + ext, { force: true });
  fs.renameSync(candidate, live);
  return { undo: before.name };
}

/** Called every minute: nightly backup after 3am, and Sunday's copy emailed to the owner */
export async function backupTick(now = new Date()) {
  const today = toDateStr(now);
  if (now.getHours() < 3 || getSetting("backup_last") === today) return;
  setSetting("backup_last", today);
  const b = makeBackup();
  if (now.getDay() === 0 && ownerPref("backup_email") && ownerEmail() && b.size < EMAIL_LIMIT) {
    await sendEmail(
      ownerEmail(),
      `Weekly backup of Moss & Moon (${toDateStr(now)})`,
      `<p>Here's this week's copy of your café's database: orders, bookings, accounts, reviews and the menu. Keep it somewhere safe.</p>
       <p style="color:#8a6a5c;font-size:13px">To restore it, open Admin → Settings → Backups and upload this file. (Photos you uploaded aren't included; they stay on the server.)</p>`,
      [{ filename: b.name, content: fs.readFileSync(b.file) }]
    );
  }
}
