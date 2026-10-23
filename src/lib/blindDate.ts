// Blind date with a book: shelf books wrapped up, with three hints. Owners write the hints in Admin.
export const HINTS = 3;
export const DEFAULT_HINTS: Record<string, string[]> = {
  "book-god-small-things": ["Kerala, 1969", "Twins, and a family that breaks the rules", "Won the Booker Prize"],
  "book-malgudi": ["A small South Indian town that isn't on any map", "Short stories", "Schoolboys, astrologers and shopkeepers"],
  "book-coffee-atlas": ["Everything about where coffee grows", "Maps, farms and brewing tips", "Written by a barista champion"],
  "book-little-prince": ["A pilot stranded in the desert", "A boy from a very small planet", "A rose, a fox and puzzled grown-ups"],
  "book-ruskin": ["Written when the author was 17", "Dehradun in the 1950s", "A boy who runs away from a strict home"],
  "book-tagore": ["Poems, not a story", "Won a Nobel Prize in 1913", "Songs of offering"],
  "book-sea-of-poppies": ["A ship leaving Calcutta, 1838", "Poppy fields along the Ganges", "The first of three"],
};
export const cleanHints = (v: unknown) => (Array.isArray(v) ? v.slice(0, HINTS).map((h) => String(h ?? "").trim().slice(0, 60)).filter(Boolean) : []);
