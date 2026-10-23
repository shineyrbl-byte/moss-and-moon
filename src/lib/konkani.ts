// Konkani word of the day: everyday Goan Konkani in Romi (Roman) script, as it's often written in Goa.
// Spellings vary from village to village. Owners: please check these and correct any that sound wrong locally.
import { seededRand } from "./gameOrders.ts";

export type KWord = { word: string; say: string; means: string; example?: string; exampleMeans?: string };

export const KONKANI: KWord[] = [
  { word: "Dev borem korum", say: "dayv BO-rem ko-RUM", means: "Thank you (literally, God bless you)", example: "Cha khatir dev borem korum!", exampleMeans: "Thanks for the tea!" },
  { word: "Kitem khobor?", say: "KEE-tem KHO-bor", means: "What's new? How are things?" },
  { word: "Hoi", say: "hoy", means: "Yes" },
  { word: "Na", say: "naa", means: "No" },
  { word: "Mhaka cha zai", say: "MHA-ka chaa ZAI", means: "I'd like tea", example: "Mhaka ek cha zai.", exampleMeans: "I'd like one tea." },
  { word: "Udok", say: "OO-dok", means: "Water" },
  { word: "Dudh", say: "doodh", means: "Milk" },
  { word: "Sakhor", say: "SAA-khor", means: "Sugar" },
  { word: "Mit", say: "meet", means: "Salt" },
  { word: "Xit kodi", say: "sheet KO-dee", means: "Rice and curry, Goa's everyday meal" },
  { word: "Nustem", say: "NOOS-tem", means: "Fish" },
  { word: "Poder", say: "po-DER", means: "The baker who cycles round with fresh pão" },
  { word: "Borem", say: "BO-rem", means: "Good" },
  { word: "Bhov borem", say: "bhov BO-rem", means: "Very good", example: "Hem bhov borem!", exampleMeans: "This is very good!" },
  { word: "Susegad", say: "soo-seh-GAAD", means: "Relaxed, unhurried: the Goan way of taking it easy" },
  { word: "Atam", say: "AA-tam", means: "Now" },
  { word: "Faleam", say: "faa-LYAAM", means: "Tomorrow", example: "Faleam mellum-ia!", exampleMeans: "See you tomorrow!" },
  { word: "Kal", say: "kaal", means: "Yesterday" },
  { word: "Sokallim", say: "so-KAL-leem", means: "In the morning" },
  { word: "Sanje", say: "SAAN-jay", means: "In the evening" },
  { word: "Rati", say: "RAA-tee", means: "At night" },
  { word: "Paus", say: "PAA-oos", means: "Rain", example: "Atam paus poddta.", exampleMeans: "It's raining now." },
  { word: "Dorya", say: "DOR-yaa", means: "The sea" },
  { word: "Ghor", say: "ghor", means: "House, home" },
  { word: "Zhadd", say: "zhadd", means: "Tree" },
  { word: "Ful", say: "fool", means: "Flower" },
  { word: "Bhurgem", say: "BHOOR-gem", means: "Child" },
  { word: "Mog", say: "mog", means: "Love" },
  { word: "Hem kitleak?", say: "hem KIT-lyaak", means: "How much is this?" },
  { word: "Khoim?", say: "khoym", means: "Where?" },
  { word: "Mhaka kollona", say: "MHA-ka KOL-lo-na", means: "I don't understand" },
  { word: "Mhaka bhuk lagta", say: "MHA-ka bhook LAG-taa", means: "I'm hungry" },
  { word: "Uprant mellum-ia", say: "oo-PRAANT mel-LOOM-ya", means: "See you later" },
  { word: "Ekdom", say: "EK-dom", means: "Totally, completely", example: "Ekdom susegad!", exampleMeans: "Totally relaxed!" },
];

/** Today's word: the list shuffled once, then one a day in turn */
export function wordIndex(date: string, n = KONKANI.length) {
  const rand = seededRand("moss-moon-konkani");
  const order = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400_000);
  return order[((day % n) + n) % n];
}
export const konkaniFor = (date: string) => KONKANI[wordIndex(date)];

const addDays = (date: string, by: number) => new Date(Date.parse(`${date}T00:00:00Z`) + by * 86400_000).toISOString().slice(0, 10);
/** The six days before (Monday to Saturday, when today is Sunday): for the Sunday quiz */
export const weekBefore = (date: string) => [6, 5, 4, 3, 2, 1].map((d) => addDays(date, -d));

/** A quiz question per word: its meaning, plus three other meanings, in a fixed shuffled order */
export function quizFor(date: string) {
  return weekBefore(date).map((d, qi) => {
    const w = konkaniFor(d);
    const rand = seededRand(`kq:${date}:${qi}`);
    const others = KONKANI.filter((x) => x.means !== w.means).map((x) => x.means);
    const picks = new Set<string>();
    while (picks.size < 3) picks.add(others[Math.floor(rand() * others.length)]);
    const choices = [w.means, ...picks].sort(() => rand() - 0.5);
    return { word: w.word, choices, answer: choices.indexOf(w.means) };
  });
}
