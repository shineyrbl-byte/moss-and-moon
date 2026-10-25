// Adopt a friend: shelter animals looking for homes. Pure bits shared by the page and server.
export const PET_KINDS = [
  { id: "dog", label: "Dog", icon: "🐶" },
  { id: "cat", label: "Cat", icon: "🐱" },
  { id: "other", label: "Someone else", icon: "🐾" },
] as const;
export type PetKind = (typeof PET_KINDS)[number]["id"];
export const petKind = (v: unknown): PetKind => (v === "cat" || v === "other" ? v : "dog");
/** Only https links to the shelter */
export const cleanLink = (v: unknown) => (typeof v === "string" && /^https:\/\/[^\s<>"]{3,200}$/.test(v.trim()) ? v.trim() : "");
