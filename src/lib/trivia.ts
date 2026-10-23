// Daily café trivia: one question a day, the same for everyone. Pure, so the server and tests share it.
// The page only ever gets the question and choices; the answer stays on the server until you've answered.
import { seededRand } from "./gameOrders.ts";

export type Question = { q: string; choices: string[]; answer: number; why: string };

export const QUESTIONS: Question[] = [
  { q: "Which Indian state grows the most coffee?", choices: ["Kerala", "Karnataka", "Tamil Nadu", "Goa"], answer: 1, why: "Karnataka grows about 70% of India's coffee, mostly in Chikmagalur, Kodagu and Hassan." },
  { q: "Where in India was coffee first planted, by legend?", choices: ["Baba Budan Giri", "Nilgiris", "Araku Valley", "Wayanad"], answer: 0, why: "Baba Budan is said to have smuggled seven beans from Yemen to the Chikmagalur hills in the 1600s." },
  { q: "What does 'ristretto' mean in Italian?", choices: ["Strong", "Restricted", "Short", "Quick"], answer: 1, why: "A ristretto is a 'restricted' shot: the same coffee with less water, so it's sweeter and thicker." },
  { q: "Which has more caffeine per cup, usually?", choices: ["Espresso shot", "Filter coffee mug", "Green tea", "Matcha latte"], answer: 1, why: "A shot is stronger per sip, but a big mug of filter coffee has more caffeine in total." },
  { q: "Robusta beans have roughly how much caffeine compared with arabica?", choices: ["Half", "The same", "Double", "Ten times"], answer: 2, why: "Robusta has about twice the caffeine, which also makes it more bitter and hardier to grow." },
  { q: "What's 'decoction' in South Indian filter coffee?", choices: ["The milk foam", "The strong brew that drips through", "The chicory", "The steel tumbler"], answer: 1, why: "Hot water drips slowly through the grounds in a two-part filter, making a thick decoction you mix with milk." },
  { q: "Why is chicory added to some Indian filter coffee?", choices: ["For caffeine", "For a fuller, slightly bitter body", "To keep it fresh", "For colour only"], answer: 1, why: "Chicory root adds body and a toasty bitterness, and once made coffee cheaper." },
  { q: "Matcha is made from…", choices: ["Roasted green tea", "Shade-grown green tea leaves, ground to powder", "Green coffee beans", "Seaweed"], answer: 1, why: "Tea plants are shaded before harvest, then the leaves are steamed, dried and stone-ground." },
  { q: "Hojicha is green tea that has been…", choices: ["Fermented", "Roasted", "Smoked", "Frozen"], answer: 1, why: "Roasting gives hojicha its toasty taste and lowers its caffeine." },
  { q: "Darjeeling tea is grown at the foot of which mountains?", choices: ["Western Ghats", "Himalayas", "Aravallis", "Nilgiris"], answer: 1, why: "Darjeeling gardens sit in the Himalayan foothills of West Bengal." },
  { q: "What's 'first flush' tea?", choices: ["The first cup of the day", "The first spring picking", "Tea with no milk", "The strongest grade"], answer: 1, why: "The first flush is the spring harvest: light, bright and prized." },
  { q: "What gives masala chai its warmth?", choices: ["Chilli", "Ginger, cardamom, cinnamon and cloves", "Coffee", "Turmeric only"], answer: 1, why: "Every home has its own mix, but ginger and cardamom are almost always in it." },
  { q: "Kokum, used in sol kadhi, is a…", choices: ["Fruit", "Root", "Seaweed", "Spice seed"], answer: 0, why: "Kokum is a sour purple fruit from the Konkan coast. Its dried rind flavours curries and drinks." },
  { q: "Goa's poee bread is best known for…", choices: ["Being sweet", "Its wheat bran coating and pocket", "Coconut filling", "Being fried"], answer: 1, why: "Poee is a round, bran-dusted bread with a hollow middle, perfect for filling." },
  { q: "Goan 'pão' came to Goa with…", choices: ["The British", "The Portuguese", "The Dutch", "Arab traders"], answer: 1, why: "The Portuguese brought yeast bread; Goan bakers (poders) still cycle it door to door." },
  { q: "What's xacuti?", choices: ["A Goan curry with roasted coconut and spices", "A fish fry", "A dessert", "A rice dish"], answer: 0, why: "Xacuti uses roasted coconut and a long list of roasted spices, often with chicken." },
  { q: "Bebinca is a Goan dessert with how many layers, traditionally?", choices: ["3", "7", "16", "50"], answer: 2, why: "Traditionally 16 layers, each baked one at a time. It takes hours." },
  { q: "Feni in Goa is made from cashew apples or…", choices: ["Coconut toddy", "Rice", "Mango", "Sugarcane"], answer: 0, why: "There's cashew feni and coconut (palm) feni." },
  { q: "Latte art is mostly drawn with…", choices: ["Syrup", "Microfoam milk", "Cocoa powder", "A stencil"], answer: 1, why: "Silky steamed milk (microfoam) poured into espresso makes the hearts and tulips." },
  { q: "A flat white has…", choices: ["More foam than a cappuccino", "Less foam than a cappuccino", "No milk", "Whipped cream"], answer: 1, why: "A flat white is smaller and has a thin layer of velvety milk, so the coffee comes through." },
  { q: "A cortado is espresso cut with…", choices: ["A little warm milk", "Tonic water", "Ice", "Cream"], answer: 0, why: "Cortado means 'cut' in Spanish: espresso with about the same amount of warm milk." },
  { q: "Cold brew is made by…", choices: ["Pouring espresso over ice", "Steeping grounds in cold water for many hours", "Freezing coffee", "Brewing with milk"], answer: 1, why: "Usually 12–24 hours in cold water, which makes it smooth and low in acid." },
  { q: "The best water temperature for brewing coffee is about…", choices: ["70°C", "80°C", "93°C", "100°C, boiling"], answer: 2, why: "Around 90–96°C. Boiling water can scorch the grounds and taste bitter." },
  { q: "Green tea tastes best with water at about…", choices: ["100°C", "80°C", "50°C", "Cold"], answer: 1, why: "Cooler water (75–85°C) keeps green tea from going bitter." },
  { q: "Which country produces the most coffee in the world?", choices: ["Colombia", "Vietnam", "Brazil", "Ethiopia"], answer: 2, why: "Brazil grows about a third of the world's coffee." },
  { q: "Coffee is thought to have been discovered in…", choices: ["Ethiopia", "Italy", "Turkey", "India"], answer: 0, why: "The story goes that a goatherd named Kaldi noticed his goats dancing after eating the berries." },
  { q: "A coffee 'cherry' usually holds how many beans?", choices: ["1", "2", "6", "Dozens"], answer: 1, why: "Two seeds face each other. Sometimes there's only one, called a peaberry." },
  { q: "What's a peaberry?", choices: ["A berry-flavoured coffee", "A single round bean in a cherry", "A small cup", "Unroasted coffee"], answer: 1, why: "About 5% of cherries grow one round bean instead of two flat ones." },
  { q: "Monsooned Malabar coffee gets its taste from…", choices: ["Monsoon winds and humidity", "Smoke", "Rainwater brewing", "Fermenting with fruit"], answer: 0, why: "Beans are left in open warehouses on the Malabar coast during the monsoon, so they swell and mellow." },
  { q: "Which milk froths the best for latte art?", choices: ["Skimmed only", "Whole milk or barista oat milk", "Almond milk", "Coconut water"], answer: 1, why: "Fat and protein make silky foam. Barista oat milks are made to behave like whole milk." },
  { q: "Dalgona coffee became famous in…", choices: ["2005", "2012", "2020", "2023"], answer: 2, why: "It went viral during the 2020 lockdowns, when everyone was whipping coffee at home." },
  { q: "Cardamom is sometimes called the queen of spices. Who's the king?", choices: ["Saffron", "Black pepper", "Cinnamon", "Clove"], answer: 1, why: "Black pepper, which also grows in Kerala and Karnataka." },
  { q: "Kashmiri kahwa is a green tea with saffron and…", choices: ["Almonds", "Mint", "Lemon", "Chocolate"], answer: 0, why: "Kahwa is brewed with saffron, cardamom and cinnamon, and served with crushed almonds." },
  { q: "What is 'crema' on an espresso?", choices: ["Added cream", "The golden foam of oils and gas", "Sugar", "Milk skin"], answer: 1, why: "Pressure pushes oils and CO₂ out of fresh coffee into a thin golden foam." },
  { q: "Freshly roasted coffee tastes best after resting for…", choices: ["An hour", "A few days to two weeks", "Six months", "A year"], answer: 1, why: "Beans give off gas after roasting. A short rest helps them brew evenly." },
  { q: "Where should you keep coffee beans at home?", choices: ["In the fridge", "Airtight, cool and dark", "In the sun", "Open in a bowl"], answer: 1, why: "Air, light, heat and moisture all go stale coffee faster. The fridge adds moisture and smells." },
  { q: "The full moon in Hindu calendars is called…", choices: ["Amavasya", "Purnima", "Ekadashi", "Ashtami"], answer: 1, why: "Purnima is the full moon; amavasya is the new moon." },
  { q: "Which of these plants is safe to keep around dogs?", choices: ["Monstera", "Snake plant", "Spider plant", "ZZ plant"], answer: 2, why: "Spider plants are non-toxic to cats and dogs. The others can upset a pup's tummy." },
  { q: "Tulsi, used in herbal teas, is also called…", choices: ["Holy basil", "Lemongrass", "Mint", "Moringa"], answer: 0, why: "Tulsi is holy basil, grown in courtyards across India." },
  { q: "Why does an iced latte taste less sweet than a hot one with the same syrup?", choices: ["Ice melts the sugar", "Cold dulls our sense of sweetness", "Syrup sinks", "It doesn't"], answer: 1, why: "Our taste buds pick up sweetness less when food is cold, so iced drinks often need a touch more." },
];

/** Today's question: the list shuffled once by a fixed seed, then one per day in turn */
export function questionIndex(date: string, n = QUESTIONS.length) {
  const rand = seededRand("moss-moon-trivia");
  const order = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400_000);
  return order[((day % n) + n) % n];
}
export const questionFor = (date: string) => QUESTIONS[questionIndex(date)];

/** Best run of days in a row (YYYY-MM-DD dates) */
export function bestRun(days: string[]) {
  const sorted = [...new Set(days)].sort();
  let best = 0, run = 0, prev = "";
  for (const d of sorted) {
    run = prev && Date.parse(`${d}T00:00:00Z`) - Date.parse(`${prev}T00:00:00Z`) === 86400_000 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
