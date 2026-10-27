// One queue for everything guests send that waits for a staff member: photos, latte art, recipes, kind notes,
// shout-outs, story lines, wishes, six-word stories and song requests. Each kind still uses its own approve/remove.
import "server-only";
import { allPhotos, reviewPhoto } from "./guestPhotos";
import { pendingArt, reviewArt } from "./latteStore";
import { recipesForStaff, reviewRecipe } from "./guestRecipeStore";
import { notesForStaff, reviewNote } from "./kindNoteStore";
import { reviewShout, shoutsForStaff } from "./shoutStore";
import { chainForStaff, reviewChainLine } from "./storyChainStore";
import { reviewWish, wishesForStaff } from "./wishStore";
import { reviewStory, storiesForStaff } from "./storyStore";
import { songAction, songList } from "./songs";
import { questionsForStaff } from "./askStore";
import { publish } from "./live";

export type Pending = { kind: Kind; id: number; text: string; who: string; img?: string; at: string };
const KINDS = {
  photo: { label: "📸 Photo", list: () => allPhotos().filter((p) => p.status === "pending").map((p) => ({ id: p.id, text: p.caption || `(${p.kind} photo)`, who: p.name, img: p.url, at: p.created_at })), review: reviewPhoto },
  latte: { label: "☕ Latte art", list: () => pendingArt().map((a) => ({ id: a.id, text: a.caption || "(latte art)", who: a.name, img: a.img, at: a.created_at })), review: (id: number, ok: boolean) => reviewArt(id, ok) },
  recipe: { label: "📝 Recipe", list: () => recipesForStaff().filter((r) => r.status === "pending").map((r) => ({ id: r.id, text: `${r.title}: ${r.intro}`.slice(0, 200), who: r.name, at: r.created_at })), review: reviewRecipe },
  note: { label: "💌 Kind note", list: () => notesForStaff().filter((n) => n.status === "pending").map((n) => ({ id: n.id, text: n.text, who: "", at: n.created_at })), review: reviewNote },
  shout: { label: "🎉 Shout-out", list: () => shoutsForStaff().filter((s) => s.status === "pending").map((s) => ({ id: s.id, text: `${s.text} (for ${s.date})`, who: s.from_name, at: s.date })), review: reviewShout },
  chain: { label: "📖 Story line", list: () => chainForStaff().map((l) => ({ id: l.id, text: l.text, who: l.name, at: l.created_at })), review: reviewChainLine },
  wish: { label: "🌳 Wish", list: () => wishesForStaff().filter((w) => w.status === "pending").map((w) => ({ id: w.id, text: w.text, who: w.name, at: w.created_at })), review: reviewWish },
  story: { label: "✍️ Six-word story", list: () => storiesForStaff().filter((s) => s.status === "pending").map((s) => ({ id: s.id, text: s.text, who: s.name, at: s.created_at })), review: reviewStory },
  song: { label: "🎵 Song request", list: () => songList().filter((s) => s.status === "pending").map((s) => ({ id: s.id, text: `${s.title}${s.artist ? ` · ${s.artist}` : ""}`, who: s.name, at: s.created_at })), review: (id: number, ok: boolean) => { const r = songAction(id, ok ? "approve" : "remove"); if (r) publish({ type: "song" }); return r; } },
} as const;
export type Kind = keyof typeof KINDS;
export const isKind = (k: unknown): k is Kind => typeof k === "string" && k in KINDS;

/** Everything waiting, oldest first, plus questions to answer (those need a written answer, so they stay on their own card) */
export function approvals() {
  const items = (Object.keys(KINDS) as Kind[]).flatMap((kind) => KINDS[kind].list().map((x) => ({ kind, label: KINDS[kind].label, ...x }))).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return { items, questions: questionsForStaff().filter((q) => q.status === "pending").length };
}
export function review(kind: unknown, id: unknown, approve: boolean) {
  if (!isKind(kind)) return { error: "What kind of post is that?" };
  const n = Math.floor(Number(id));
  // Only things still waiting (someone else may have just dealt with it on another screen)
  if (!(KINDS[kind].list() as { id: number }[]).some((x) => x.id === n)) return { error: "That one has already been dealt with." };
  const ok = KINDS[kind].review(n, approve);
  return ok ? approvals() : { error: "That one has already been dealt with." };
}
export const pendingCount = () => { const a = approvals(); return a.items.length + a.questions; };
