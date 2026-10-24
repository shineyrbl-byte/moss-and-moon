// "Meet the team": public profiles for staff who choose to be shown (first name only).
import "server-only";
import { latteWins } from "./latteStore";
import { db, cleanText } from "./db";
import { isOurPhoto } from "./uploads";
import { getMenu } from "./menuStore";
import { getCreation } from "./lab";

export type Profile = { staff_id: number; show: number; bio: string; fav_item: string | null; creation_code: string | null; photo: string | null; emoji: string };

const firstName = (n: string) => n.trim().split(/\s+/)[0];

/** Owner: every active staff member with their profile (blank if none yet) */
export function teamForOwner() {
  const staff = db.prepare("SELECT id, name, role FROM staff WHERE active = 1 ORDER BY name").all() as { id: number; name: string; role: string }[];
  return staff.map((s) => {
    const p = db.prepare("SELECT * FROM team_profiles WHERE staff_id = ?").get(s.id) as Profile | undefined;
    return { id: s.id, name: s.name, role: s.role, show: !!p?.show, bio: p?.bio ?? "", favItem: p?.fav_item ?? "", creationCode: p?.creation_code ?? "", photo: p?.photo ?? "", emoji: p?.emoji ?? "☕" };
  });
}

export function saveProfile(b: Record<string, unknown>) {
  const id = Math.floor(Number(b.id));
  if (!db.prepare("SELECT 1 FROM staff WHERE id = ? AND active = 1").get(id)) return { error: "We couldn't find that team member." };
  const menu = getMenu({ includeHidden: true });
  const fav = typeof b.favItem === "string" && menu.some((m) => m.id === b.favItem) ? b.favItem : null;
  const code = cleanText(b.creationCode, 12).toUpperCase().replace(/^.*\/LAB\//, "");
  if (code && !getCreation(code)) return { error: "That drink lab code doesn't match a creation." };
  const photo = b.photo && isOurPhoto(b.photo) ? String(b.photo) : null;
  const emoji = cleanText(b.emoji, 4) || "☕";
  db.prepare(`INSERT INTO team_profiles (staff_id, show, bio, fav_item, creation_code, photo, emoji) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(staff_id) DO UPDATE SET show = excluded.show, bio = excluded.bio, fav_item = excluded.fav_item, creation_code = excluded.creation_code, photo = excluded.photo, emoji = excluded.emoji`)
    .run(id, b.show ? 1 : 0, cleanText(b.bio, 240), fav, code || null, photo, emoji);
  return { ok: true as const };
}

/** The public page: shown, active staff with their favourite drink and creation */
export function publicTeam() {
  const rows = db.prepare("SELECT s.name, s.role, p.* FROM team_profiles p JOIN staff s ON s.id = p.staff_id WHERE p.show = 1 AND s.active = 1 ORDER BY s.role = 'owner' DESC, s.name").all() as (Profile & { name: string; role: string })[];
  const menu = new Map(getMenu().map((m) => [m.id, m]));
  const latte = latteWins();
  return rows.map((r) => {
    const fav = r.fav_item ? menu.get(r.fav_item) : undefined;
    const c = r.creation_code ? getCreation(r.creation_code) : null;
    return {
      id: r.staff_id, name: firstName(r.name), role: r.role === "owner" ? "Owner" : "Barista", bio: r.bio, photo: r.photo, emoji: r.emoji,
      fav: fav ? { id: fav.id, name: fav.name, price: fav.price, img: fav.img, soldOut: !!fav.soldOut } : null,
      creation: c,
      latte: latte.get(r.staff_id) ?? null,
    };
  });
}
