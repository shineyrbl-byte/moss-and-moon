// Drink lab: guests mix their own drink from a base on the menu, name it and share it.
// Anyone can order a creation in one tap; the best ones rise up the board by votes.
import "server-only";
import crypto from "node:crypto";
import { db, cleanText } from "./db";
import { getMenu } from "./menuStore";
import { cleanOptions, describeOptions, unitPrice, type Options } from "./pricing";
import type { MenuItem } from "./menu";

const BAD = /\b(fuck|shit|bitch|cunt|dick|porn|nazi|chutiya|madarchod|bhenchod|gandu)\b/i;
export const LAB_BASES = (menu: MenuItem[]) => menu.filter((m) => ["coffee", "tea", "cold"].includes(m.cat) && !m.groups?.length && !m.kids && !m.hidden);

type Row = { id: number; code: string; name: string; base_id: string; opts: string; creator: string; votes: number; hidden: number; created_at: string };
export type Creation = { code: string; name: string; creator: string; votes: number; baseId: string; baseName: string; img: string; opts: Options; describe: string; price: number; available: boolean; created_at: string };

function view(r: Row, menu: Map<string, MenuItem>): Creation | null {
  const base = menu.get(r.base_id);
  if (!base) return null;
  const opts = cleanOptions(base, JSON.parse(r.opts));
  return { code: r.code, name: r.name, creator: r.creator, votes: r.votes, baseId: base.id, baseName: base.name, img: base.img, opts, describe: describeOptions(base, opts), price: unitPrice(base, opts), available: !base.soldOut && !base.hidden, created_at: r.created_at };
}

export function saveCreation(b: Record<string, unknown>, customerId: number | null): Creation | { error: string } {
  const name = cleanText(b.name, 30).replace(/[<>]/g, "");
  const creator = cleanText(b.creator, 20).replace(/[<>]/g, "") || "A guest";
  if (name.length < 3) return { error: "Give your drink a name (3 letters or more)." };
  if (BAD.test(name) || BAD.test(creator)) return { error: "Let's keep names friendly ✿" };
  const menu = getMenu();
  const base = LAB_BASES(menu).find((m) => m.id === b.baseId);
  if (!base) return { error: "Pick a drink to start from." };
  const { note: _note, ...opts } = cleanOptions(base, b.opts ?? {}); // eslint-disable-line @typescript-eslint/no-unused-vars
  if (db.prepare("SELECT 1 FROM creations WHERE lower(name) = lower(?) AND hidden = 0").get(name)) return { error: "Someone already made a drink with that name. Try another?" };
  const code = crypto.randomBytes(4).toString("base64url").replace(/[-_]/g, "x").slice(0, 6).toUpperCase();
  db.prepare("INSERT INTO creations (code, name, base_id, opts, creator, customer_id) VALUES (?, ?, ?, ?, ?, ?)").run(code, name, base.id, JSON.stringify(opts), creator, customerId);
  return getCreation(code)!;
}

export function getCreation(code: string): Creation | null {
  const r = db.prepare("SELECT * FROM creations WHERE code = ? AND hidden = 0").get(code.toUpperCase()) as Row | undefined;
  return r ? view(r, new Map(getMenu({ includeHidden: true }).map((m) => [m.id, m]))) : null;
}

/** The board: most-loved and newest */
export function labBoard() {
  const menu = new Map(getMenu({ includeHidden: true }).map((m) => [m.id, m]));
  const list = (sql: string) => (db.prepare(sql).all() as Row[]).map((r) => view(r, menu)).filter((c): c is Creation => !!c);
  return {
    top: list("SELECT * FROM creations WHERE hidden = 0 AND votes > 0 ORDER BY votes DESC, id DESC LIMIT 12"),
    newest: list("SELECT * FROM creations WHERE hidden = 0 ORDER BY id DESC LIMIT 12"),
  };
}

/** One vote per visitor per drink (the visitor id is a random string kept in their browser) */
export function voteCreation(code: string, voter: string) {
  if (!/^[\w-]{16,64}$/.test(voter)) return { error: "Couldn't count that vote." };
  const c = db.prepare("SELECT id FROM creations WHERE code = ? AND hidden = 0").get(code.toUpperCase()) as { id: number } | undefined;
  if (!c) return { error: "We couldn't find that drink." };
  const key = crypto.createHash("sha256").update(voter).digest("hex").slice(0, 32);
  const added = db.prepare("INSERT OR IGNORE INTO creation_votes (creation_id, voter) VALUES (?, ?)").run(c.id, key).changes;
  if (added) db.prepare("UPDATE creations SET votes = votes + 1 WHERE id = ?").run(c.id);
  const votes = (db.prepare("SELECT votes FROM creations WHERE id = ?").get(c.id) as { votes: number }).votes;
  return { ok: true as const, votes, counted: !!added };
}

/** Owner: take a creation down */
export const hideCreation = (code: string) => db.prepare("UPDATE creations SET hidden = 1 WHERE code = ?").run(code.toUpperCase()).changes > 0;
