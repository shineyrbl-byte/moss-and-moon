// Six-word stories: exactly six words about coffee, cafés or anything at all.
export const STORY_WORDS = 6;
/** The words in a story: split on spaces; hyphenated words count as one; punctuation alone doesn't count */
export const storyWords = (t: string) => t.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
export const isSixWords = (t: string) => storyWords(t).length === STORY_WORDS;
