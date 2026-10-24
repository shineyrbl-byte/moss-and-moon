// What's in season around Goa, month by month (1 = January), and which dishes use it.
// Rough local seasons: worth checking with your fruit seller, and change them here if they're off.
export type Fruit = { id: string; name: string; emoji: string; months: number[]; note: string; match: RegExp };

export const FRUITS: Fruit[] = [
  { id: "mango", name: "Mango", emoji: "🥭", months: [3, 4, 5, 6], note: "Mankurad first, then Alphonso. The whole state waits for these.", match: /mango|alphonso|aam/i },
  { id: "cashew", name: "Cashew apple", emoji: "🍎", months: [3, 4, 5], note: "The fruit on top of the nut. Feni season.", match: /cashew/i },
  { id: "jackfruit", name: "Jackfruit", emoji: "🍈", months: [4, 5, 6, 7], note: "Huge, sticky and sweet. Ripe ones scent the whole market.", match: /jackfruit/i },
  { id: "kokum", name: "Kokum", emoji: "🟣", months: [4, 5, 6], note: "Sour purple fruit, dried for curries and cool summer drinks.", match: /kokum/i },
  { id: "jamun", name: "Jamun", emoji: "🫐", months: [5, 6], note: "Turns your tongue purple. Only around for a few weeks.", match: /jamun/i },
  { id: "watermelon", name: "Watermelon", emoji: "🍉", months: [2, 3, 4, 5], note: "The hot months' fruit, best ice cold.", match: /watermelon/i },
  { id: "orange", name: "Orange", emoji: "🍊", months: [11, 12, 1, 2], note: "Nagpur oranges arrive with the cooler weather.", match: /orange/i },
  { id: "strawberry", name: "Strawberry", emoji: "🍓", months: [12, 1, 2, 3], note: "Down from Mahabaleshwar's hills in winter.", match: /strawberr/i },
  { id: "guava", name: "Guava", emoji: "🍐", months: [10, 11, 12, 1, 2], note: "Pink inside, with salt and chilli on top.", match: /guava/i },
  { id: "banana", name: "Banana", emoji: "🍌", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], note: "Always here, from tiny elaichi bananas to big Goan ones.", match: /banana/i },
  { id: "coconut", name: "Coconut", emoji: "🥥", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], note: "From the palms on every road. In half of Goan cooking.", match: /coconut/i },
];

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** In season in this month, the year-round ones last */
export const inSeason = (month: number) => FRUITS.filter((f) => f.months.includes(month)).sort((a, b) => (a.months.length === 12 ? 1 : 0) - (b.months.length === 12 ? 1 : 0));
/** Coming next month that isn't here this month */
export const comingNext = (month: number) => { const next = (month % 12) + 1; return FRUITS.filter((f) => f.months.includes(next) && !f.months.includes(month)); };
/** Dishes that use a fruit, by name */
export const dishesWith = <T extends { name: string }>(f: Fruit, items: T[]) => items.filter((m) => f.match.test(m.name));
