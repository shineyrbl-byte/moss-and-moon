// Game progress that follows a signed-in account. The device sends what it has; the server merges and sends back the lot.
import "server-only";
import { db } from "./db";
import { MAX_BYTES, clean, mergeBlobs, type Blob } from "./syncMerge";

const cleanVoter = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{16,64}$/i.test(v) ? v.toLowerCase() : null);

export function readSync(customerId: number): Blob {
  const row = db.prepare("SELECT data FROM account_sync WHERE customer_id = ?").get(customerId) as { data: string } | undefined;
  try { return row ? clean(JSON.parse(row.data)) : {}; } catch { return {}; }
}
/** { voter, data }: link this browser to the account and merge its progress in */
export function pushSync(customerId: number, b: Record<string, unknown>) {
  const voter = cleanVoter(b.voter);
  if (voter) db.prepare("INSERT OR IGNORE INTO account_voters (customer_id, voter) VALUES (?, ?)").run(customerId, voter);
  const merged = mergeBlobs(readSync(customerId), clean(b.data));
  const json = JSON.stringify(merged);
  if (json.length > MAX_BYTES) return { error: "That's more saved progress than we can keep. Try clearing some old games." };
  db.prepare(`INSERT INTO account_sync (customer_id, data, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(customer_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`).run(customerId, json, Date.now());
  return { data: merged, voters: votersFor(customerId).length };
}
/** Every browser id this account has played from */
export function votersFor(customerId: number | null): string[] {
  if (!customerId) return [];
  return (db.prepare("SELECT voter FROM account_voters WHERE customer_id = ?").all(customerId) as { voter: string }[]).map((r) => r.voter);
}
