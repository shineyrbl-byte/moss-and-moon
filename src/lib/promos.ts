// Promo codes, managed by the owner in /admin → Promos
import "server-only";
import { db, cleanPhone } from "./db";
import { promoLabel, type PromoRule } from "./pricing";
import { toDateStr } from "./cafe";

export type PromoRow = {
  code: string; kind: "percent" | "amount"; value: number; min_order: number; max_uses: number | null; uses: number;
  once_per_guest: number; starts: string | null; expires: string | null; active: number; note: string | null; created_at: string;
};

export const toRule = (p: PromoRow): PromoRule => ({ code: p.code, kind: p.kind, value: p.value, minOrder: p.min_order });

/** Check a code for this guest. Returns the rule, or a friendly reason it can't be used. */
export function checkPromo(raw: unknown, phone?: string): { rule: PromoRule; label: string } | { error: string } {
  const code = String(raw ?? "").trim().toUpperCase();
  if (!code) return { error: "Type a code first." };
  const p = db.prepare("SELECT * FROM promos WHERE code = ?").get(code) as PromoRow | undefined;
  const today = toDateStr(new Date());
  if (!p || !p.active) return { error: "That code doesn't look right." };
  if (p.starts && today < p.starts) return { error: `That code starts on ${p.starts}.` };
  if (p.expires && today > p.expires) return { error: "Sorry, that code has expired." };
  if (p.max_uses !== null && p.uses >= p.max_uses) return { error: "That code has been used up. Sorry!" };
  const digits = cleanPhone(phone ?? "");
  if (p.once_per_guest && digits && db.prepare("SELECT 1 FROM orders WHERE promo = ? AND phone = ?").get(code, digits))
    return { error: "You've already used this code ✿" };
  const rule = toRule(p);
  return { rule, label: promoLabel(rule) };
}

export const usePromo = (code: string) => db.prepare("UPDATE promos SET uses = uses + 1 WHERE code = ?").run(code);
