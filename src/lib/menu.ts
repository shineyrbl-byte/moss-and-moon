// The starting menu. On first run it is copied into the database; after that,
// staff edit the menu from /admin → Menu (no code changes needed).
import type { Lang } from "./i18n";

export type Category = "coffee" | "tea" | "cold" | "food" | "bakes" | "shop";

/** Something extra on a food item, e.g. "Add an egg +₹40". adds/removes change its allergens. */
export type Addon = { id: string; label: string; price: number; kcal?: number; adds?: string[]; removes?: string[] };
/** "Pick one" or "pick up to three" choices, for build-your-own items and tasting flights */
export type ChoiceGroup = { id: string; label: string; min: number; max: number; choices: Addon[] };
export type Diet = "vegan" | "gf";

export type MenuItem = {
  id: string;
  cat: Category;
  name: string;
  desc: string;
  price: number;
  img: string; // Unsplash photo id, or an uploaded photo path like /api/uploads/abc.jpg
  diet?: Diet[];
  badge?: "bestseller" | "new" | "pink pick";
  // Used by the "find your drink" quiz (drinks only)
  traits?: { energy: 0 | 1 | 2; sweet: 0 | 1 | 2; temp: "hot" | "iced" };
  hidden?: boolean; // staff can hide items without deleting them
  /** Seasonal: only on the menu between these dates (YYYY-MM-DD, either can be left empty) */
  from?: string;
  until?: string;
  /** Pick one of these (e.g. grind for beans, colour for a mug); the first is the default */
  variants?: { id: string; label: string; price: number }[];
  /** Shop items: how many are in stock (sells out at 0). Leave empty to not count. */
  stock?: number;
  /** Food add-ons guests can pick (extra cheese, gluten-free bread, make it a combo…) */
  addons?: Addon[];
  /** Drinks made without milk (smoothies, juices, mocktails): no milk choice */
  noMilk?: boolean;
  /** Allergens in the item itself (a drink's milk is added on top, see lib/nutrition.ts) */
  allergens?: import("./nutrition").Allergen[];
  /** Rough calories, regular size as it usually comes */
  kcal?: number;
  /** What one costs to make in ₹, on top of tracked ingredients (e.g. a whole croissant from the bakery) */
  cost?: number;
  /** Festival special: only on the menu during this season (see lib/seasons.ts) */
  season?: string;
  /** Ingredients used per item (leave empty to use sensible defaults for drinks) */
  uses?: { ingredient: string; amount: number }[];
  soldOut?: boolean; // filled in from the database
  /** Build-your-own / flights: groups of choices (the item then has no drink options) */
  groups?: ChoiceGroup[];
  /** Food that also comes as a half portion (about 60% of the price) */
  half?: boolean;
  /** Shown in the Kids section */
  kids?: boolean;
  /** Only on the menu in this part of the year (see rotationNow) */
  rotation?: Rotation;
  /** Owner's pick, shown first under "Staff picks" */
  staffPick?: boolean;
  /** Hindi name and description, shown when a guest switches to हिन्दी */
  nameHi?: string;
  descHi?: string;
  /** Marathi and Konkani names (Konkani falls back to Marathi, then Hindi) */
  nameMr?: string;
  nameKok?: string;
  /** % of guests who gave it a thumbs up (only with enough ratings) */
  loved?: number;
  /** Only sold at these branches (unset = everywhere) */
  branches?: string[];
};

export const photo = (img: string, w = 900) =>
  img.startsWith("/") || img.startsWith("http") ? img : `https://images.unsplash.com/photo-${img}?auto=format&fit=crop&q=75&w=${w}`;

/** Menu tabs: every category, plus "all" and "specials" (new, pink picks and festival drinks) */
export type MenuTab = Category | "all" | "specials" | "kids";
/** Seasonal rotation, Goa style: summer Mar–May, monsoon Jun–Sep, winter Oct–Feb */
export type Rotation = "summer" | "monsoon" | "winter";
export const ROTATIONS: { id: Rotation; label: string; months: number[] }[] = [
  { id: "summer", label: "Summer (Mar–May)", months: [3, 4, 5] },
  { id: "monsoon", label: "Monsoon (Jun–Sep)", months: [6, 7, 8, 9] },
  { id: "winter", label: "Winter (Oct–Feb)", months: [10, 11, 12, 1, 2] },
];
export const rotationFor = (d = new Date()): Rotation => ROTATIONS.find((r) => r.months.includes(d.getMonth() + 1))!.id;
export const CATEGORY_ORDER: Category[] = ["coffee", "tea", "cold", "food", "bakes", "shop"];
export const inTab = (m: Pick<MenuItem, "cat" | "badge" | "season" | "kids">, tab: MenuTab) =>
  tab === "all" || (tab === "specials" ? m.badge === "new" || m.badge === "pink pick" || !!m.season : tab === "kids" ? !!m.kids : m.cat === tab);

export const CATEGORIES: { id: MenuTab; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "specials", label: "Specials" },
  { id: "coffee", label: "Coffee" },
  { id: "tea", label: "Tea & matcha" },
  { id: "cold", label: "Cold drinks" },
  { id: "food", label: "Food" },
  { id: "bakes", label: "Bakes & sweets" },
  { id: "kids", label: "Kids" },
  { id: "shop", label: "Shop" },
];

const BASE_MENU: MenuItem[] = [
  // ----- coffee -----
  { id: "honey-oat-latte", cat: "coffee", name: "Honey Oat Latte", desc: "Double espresso, silky oat milk and wildflower honey.", price: 220, img: "1541167760496-1628856ab772", badge: "bestseller", traits: { energy: 1, sweet: 2, temp: "hot" } },
  { id: "rose-latte", cat: "coffee", name: "Rose Pistachio Latte", desc: "Our pink signature — rose syrup, pistachio cream, espresso.", price: 250, img: "1517487881594-2787fef5ebf7", badge: "pink pick", traits: { energy: 1, sweet: 2, temp: "hot" } },
  { id: "pour-over", cat: "coffee", name: "V60 Pour-Over", desc: "Single-origin, hand-poured. Ask about today's bean.", price: 240, img: "1442512595331-e89e73853f31", diet: ["vegan", "gf"], traits: { energy: 2, sweet: 0, temp: "hot" } },
  { id: "cappuccino", cat: "coffee", name: "Classic Cappuccino", desc: "Equal parts espresso, steamed milk and foam.", price: 200, img: "1572442388796-11668a67e53d", diet: ["gf"], traits: { energy: 1, sweet: 0, temp: "hot" } },
  { id: "cortado", cat: "coffee", name: "Cardamom Cortado", desc: "Short, strong and a little spiced.", price: 190, img: "1559496417-e7f25cb247f3", diet: ["gf"], traits: { energy: 2, sweet: 1, temp: "hot" } },
  { id: "iced-brown-sugar", cat: "coffee", name: "Iced Brown Sugar Shaken", desc: "Espresso shaken with brown sugar and cinnamon over ice.", price: 230, img: "1461023058943-07fcbe16d735", badge: "new", traits: { energy: 2, sweet: 2, temp: "iced" } },
  { id: "americano", cat: "coffee", name: "Long Black", desc: "Espresso over hot water. Clean and bold.", price: 160, img: "1514432324607-a09d9b4aefdd", diet: ["vegan", "gf"], traits: { energy: 2, sweet: 0, temp: "hot" } },

  // ----- tea & matcha -----
  { id: "matcha", cat: "tea", name: "Ceremonial Matcha", desc: "Whisked to order from Uji matcha, with your choice of milk.", price: 260, img: "1515823064-d6e0c04616a7", badge: "bestseller", diet: ["gf"], traits: { energy: 1, sweet: 1, temp: "hot" } },
  { id: "honey-matcha", cat: "tea", name: "Honey Matcha Latte", desc: "Matcha softened with honey — our study-session favourite.", price: 270, img: "1536256263959-770b48d82b0a", diet: ["gf"], traits: { energy: 1, sweet: 2, temp: "hot" } },
  { id: "boba", cat: "tea", name: "Brown Sugar Boba", desc: "Milk tea with chewy tiger-stripe pearls.", price: 240, img: "1525803377221-4f6ccdaa5133", badge: "new", diet: ["gf"], traits: { energy: 0, sweet: 2, temp: "iced" } },
  { id: "chai", cat: "tea", name: "Rose Masala Chai", desc: "House-spiced chai with dried rose petals.", price: 150, img: "1544787219-7f47ccb76574", diet: ["gf"], traits: { energy: 1, sweet: 1, temp: "hot" } },
  { id: "chamomile", cat: "tea", name: "Chamomile & Honey", desc: "Loose-leaf chamomile for slow evenings.", price: 170, img: "1576092768241-dec231879fc3", diet: ["gf"], traits: { energy: 0, sweet: 1, temp: "hot" } },
  { id: "oolong", cat: "tea", name: "Oolong Pot for Two", desc: "Roasted oolong served in a little ceramic pot.", price: 220, img: "1564890369478-c89ca6d9cde9", diet: ["vegan", "gf"], traits: { energy: 1, sweet: 0, temp: "hot" } },
  { id: "lemon-iced-tea", cat: "tea", name: "Lime & Mint Iced Tea", desc: "Black tea, fresh lime and mint over crushed ice.", price: 160, img: "1556679343-c7306c1976bc", diet: ["vegan", "gf"], traits: { energy: 1, sweet: 1, temp: "iced" } },

  // ----- bakes & sweets -----
  { id: "croissant", cat: "bakes", name: "Butter Croissant", desc: "Flaky, golden, 72-hour laminated dough.", price: 150, img: "1555507036-ab1f4038808a", badge: "bestseller" },
  { id: "macarons", cat: "bakes", name: "Rose Macarons (box of 4)", desc: "Rose, raspberry, pistachio and vanilla.", price: 260, img: "1569864358642-9d1684040f43", badge: "pink pick", diet: ["gf"] },
  { id: "panna-cotta", cat: "bakes", name: "Strawberry Panna Cotta", desc: "Vanilla cream set in a little jar, fresh strawberries.", price: 230, img: "1488477181946-6428a0291777", diet: ["gf"] },
  { id: "cheesecake", cat: "bakes", name: "Blueberry Cheesecake", desc: "Baked New York style with blueberry compote.", price: 280, img: "1533134242443-d4fd215305ad" },
  { id: "tiramisu", cat: "bakes", name: "Tiramisu", desc: "Espresso-soaked ladyfingers and mascarpone.", price: 290, img: "1571877227200-a0d98ea607e9" },
  { id: "fudge-cake", cat: "bakes", name: "Midnight Fudge Cake", desc: "Three layers of dark chocolate. Dangerous.", price: 270, img: "1578985545062-69928b1d9587" },
  { id: "cookie", cat: "bakes", name: "Brown Butter Cookie", desc: "Sea salt and dark chocolate chunks.", price: 110, img: "1558961363-fa8fdf82db35" },
  { id: "cupcake", cat: "bakes", name: "Mocha Cupcake", desc: "Chocolate sponge, espresso buttercream.", price: 140, img: "1550617931-e17a7b70dce2" },
  { id: "mint-cupcake", cat: "bakes", name: "Pastel Mint Cupcake", desc: "Vanilla sponge, mint frosting, sprinkles.", price: 140, img: "1486427944299-d1955d23e34d", badge: "new" },
  { id: "donut", cat: "bakes", name: "Sprinkle Donut", desc: "Brioche donut with chocolate glaze.", price: 130, img: "1551024601-bec78aea704b" },
  { id: "sourdough", cat: "bakes", name: "Seeded Sourdough & Butter", desc: "A thick slice of our daily loaf, toasted.", price: 120, img: "1509440159596-0249088772ff", diet: ["vegan"] },
];

// Added in the October 2026 menu update: cold drinks and savoury food.
// (Older databases get these once; see lib/db.ts.)
const combo = (id: string, label: string, price: number): Addon => ({ id, label, price });
const GF_BREAD: Addon = { id: "gf-bread", label: "Gluten-free bread", price: 50, removes: ["gluten"] };
const CHEESE: Addon = { id: "cheese", label: "Extra cheese", price: 40, kcal: 110, adds: ["milk"] };
const EGG: Addon = { id: "egg", label: "Add a fried egg", price: 40, kcal: 90, adds: ["egg"] };
const COMBO_COFFEE = combo("combo-coffee", "Make it a combo: + cappuccino", 120);
const COMBO_CHAI = combo("combo-chai", "Make it a combo: + masala chai", 90);

export const MENU_V2: MenuItem[] = [
  // Cold drinks
  { id: "cold-brew", cat: "cold", name: "Slow Cold Brew", desc: "Steeped for 18 hours. Smooth, chocolatey, served over ice.", price: 210, img: "1517701604599-bb29b565090c", diet: ["vegan", "gf"], traits: { energy: 2, sweet: 0, temp: "iced" }, allergens: [], kcal: 15, uses: [{ ingredient: "espresso-beans", amount: 22 }] },
  { id: "iced-mocha", cat: "cold", name: "Iced Mocha", desc: "Espresso, dark chocolate and cold milk over ice.", price: 240, img: "1592663527359-cf6642f54cff", traits: { energy: 1, sweet: 2, temp: "iced" }, allergens: ["soy"], kcal: 260, cost: 12 },
  { id: "oreo-frappe", cat: "cold", name: "Cookies & Cream Frappé", desc: "Blended espresso, milk, ice and crushed chocolate cookies.", price: 260, img: "1572490122747-3968b75cc699", badge: "new", traits: { energy: 1, sweet: 2, temp: "iced" }, allergens: ["gluten", "soy"], kcal: 420, cost: 25 },
  { id: "berry-smoothie", cat: "cold", name: "Very Berry Smoothie", desc: "Strawberry, blueberry and banana blended with thick curd.", price: 230, img: "1553530666-ba11a7da3888", diet: ["gf"], noMilk: true, traits: { energy: 0, sweet: 1, temp: "iced" }, allergens: ["milk"], kcal: 210, cost: 70 },
  { id: "mango-smoothie", cat: "cold", name: "Mango Lassi Smoothie", desc: "Alphonso mango, curd and a pinch of cardamom.", price: 220, img: "1623065422902-30a2d299bbe4", diet: ["gf"], noMilk: true, badge: "bestseller", traits: { energy: 0, sweet: 2, temp: "iced" }, allergens: ["milk"], kcal: 240, cost: 60 },
  { id: "strawberry-banana", cat: "cold", name: "Strawberry Banana Smoothie", desc: "Blended with oat yogurt, so it's fully plant-based.", price: 220, img: "1579954115545-a95591f28bfc", diet: ["vegan", "gf"], noMilk: true, traits: { energy: 0, sweet: 1, temp: "iced" }, allergens: [], kcal: 190, cost: 65 },
  { id: "blackberry-fizz", cat: "cold", name: "Blackberry Ginger Fizz", desc: "Mocktail: blackberry, fresh ginger, lime and soda.", price: 200, img: "1536935338788-846bb9981813", diet: ["vegan", "gf"], noMilk: true, traits: { energy: 0, sweet: 1, temp: "iced" }, allergens: [], kcal: 110, cost: 45 },
  { id: "strawberry-mojito", cat: "cold", name: "Strawberry Mint Mojito", desc: "Mocktail: muddled strawberry, mint and lime with soda.", price: 190, img: "1497534446932-c925b458314e", diet: ["vegan", "gf"], noMilk: true, badge: "pink pick", traits: { energy: 0, sweet: 1, temp: "iced" }, allergens: [], kcal: 100, cost: 40 },
  { id: "passionfruit-lemonade", cat: "cold", name: "Passionfruit Lemonade", desc: "Fresh lemons, passionfruit and a little honey.", price: 180, img: "1546173159-315724a31696", diet: ["gf"], noMilk: true, traits: { energy: 0, sweet: 2, temp: "iced" }, allergens: [], kcal: 120, cost: 35 },
  { id: "fresh-orange", cat: "cold", name: "Fresh Orange Juice", desc: "Squeezed to order. Nothing else.", price: 160, img: "1600271886742-f049cd451bba", diet: ["vegan", "gf"], noMilk: true, traits: { energy: 0, sweet: 1, temp: "iced" }, allergens: [], kcal: 110, cost: 45 },
  // Food
  { id: "cheese-toastie", cat: "food", name: "Three Cheese Toastie", desc: "Cheddar, mozzarella and a little blue, pressed on sourdough.", price: 220, img: "1528736235302-52922df5c122", badge: "bestseller", allergens: ["gluten", "milk"], kcal: 480, cost: 70, addons: [CHEESE, EGG, GF_BREAD, COMBO_COFFEE] },
  { id: "club-sandwich", cat: "food", name: "Garden Club Sandwich", desc: "Egg, cheese, tomato, lettuce and herb mayo, triple-stacked.", price: 260, img: "1553909489-cd47e0907980", allergens: ["gluten", "milk", "egg"], kcal: 520, cost: 80, addons: [CHEESE, GF_BREAD, COMBO_COFFEE] },
  { id: "bombay-grill", cat: "food", name: "Bombay Masala Grill", desc: "Spiced potato, beetroot, cheese and green chutney, grilled.", price: 200, img: "1528735602780-2552fd46c7af", allergens: ["gluten", "milk"], kcal: 450, cost: 55, addons: [CHEESE, GF_BREAD, COMBO_CHAI] },
  { id: "avocado-toast", cat: "food", name: "Smashed Avocado Toast", desc: "Lime, chilli flakes and seeds on toasted sourdough.", price: 280, img: "1588137378633-dea1336ce1e2", diet: ["vegan"], allergens: ["gluten", "sesame"], kcal: 360, cost: 95, addons: [{ id: "poached-egg", label: "Add a poached egg", price: 40, kcal: 80, adds: ["egg"] }, { id: "feta", label: "Crumbled feta", price: 50, kcal: 80, adds: ["milk"] }, { id: "chilli-crunch", label: "Chilli crunch oil", price: 20, kcal: 45 }, GF_BREAD, COMBO_COFFEE] },
  { id: "egg-toast", cat: "food", name: "Sunny Egg & Chilli Toast", desc: "Two fried eggs, chilli butter and spring onion on sourdough.", price: 240, img: "1525351484163-7529414344d8", allergens: ["gluten", "egg", "milk"], kcal: 410, cost: 50, addons: [EGG, CHEESE, GF_BREAD, COMBO_CHAI] },
  { id: "pancakes", cat: "food", name: "Buttermilk Pancake Stack", desc: "Three fluffy pancakes, maple syrup and butter.", price: 290, img: "1567620905732-2d1ec7ab7445", allergens: ["gluten", "milk", "egg"], kcal: 620, cost: 60, addons: [{ id: "berries", label: "Fresh berries", price: 50, kcal: 40 }, { id: "nutella", label: "Nutella drizzle", price: 40, kcal: 110, adds: ["nuts", "soy"] }, { id: "cream", label: "Whipped cream", price: 30, kcal: 90 }, COMBO_COFFEE] },
  { id: "penne-arrabbiata", cat: "food", name: "Penne Arrabbiata", desc: "Slow tomato, garlic and chilli sauce, basil.", price: 320, img: "1621996346565-e3dbc646d9a9", diet: ["vegan"], allergens: ["gluten"], kcal: 540, cost: 70, addons: [{ id: "parmesan", label: "Parmesan", price: 40, kcal: 80, adds: ["milk"] }, { id: "garlic-bread", label: "Garlic bread on the side", price: 60, kcal: 180, adds: ["milk"] }, { id: "gf-pasta", label: "Gluten-free pasta", price: 60, removes: ["gluten"] }] },
  { id: "pesto-pasta", cat: "food", name: "Basil Pesto Farfalle", desc: "Fresh basil, pine nut pesto, cherry tomatoes and greens.", price: 340, img: "1473093295043-cdd812d0e601", diet: ["vegan"], allergens: ["gluten", "nuts"], kcal: 580, cost: 90, addons: [{ id: "parmesan", label: "Parmesan", price: 40, kcal: 80, adds: ["milk"] }, { id: "gf-pasta", label: "Gluten-free pasta", price: 60, removes: ["gluten"] }] },
  { id: "buddha-bowl", cat: "food", name: "Rainbow Buddha Bowl", desc: "Quinoa, roast veg, chickpeas, avocado and tahini.", price: 330, img: "1512621776951-a57141f2eefd", diet: ["vegan", "gf"], badge: "new", allergens: ["sesame"], kcal: 520, cost: 110, addons: [{ id: "paneer", label: "Grilled paneer", price: 60, kcal: 160, adds: ["milk"] }, { id: "boiled-egg", label: "Soft-boiled egg", price: 40, kcal: 70, adds: ["egg"] }, { id: "extra-avo", label: "Extra avocado", price: 50, kcal: 80 }] },
  { id: "granola-bowl", cat: "food", name: "Fruit & Granola Bowl", desc: "Thick curd, house granola, seasonal fruit and honey.", price: 250, img: "1490474418585-ba9bad8fd0ea", allergens: ["milk", "nuts", "gluten"], kcal: 430, cost: 75, addons: [{ id: "vegan-yogurt", label: "Oat yogurt instead", price: 30, removes: ["milk"] }, { id: "extra-fruit", label: "Extra fruit", price: 40, kcal: 40 }, { id: "peanut-butter", label: "Peanut butter", price: 30, kcal: 95, adds: ["nuts"] }] },
  { id: "margherita-flatbread", cat: "food", name: "Margherita Flatbread", desc: "Wood-fired, tomato, mozzarella and basil. Good for sharing.", price: 350, img: "1565299624946-b28f40a0ae38", allergens: ["gluten", "milk"], kcal: 780, cost: 85, addons: [{ id: "chilli", label: "Chilli oil & jalapeños", price: 30, kcal: 40 }, CHEESE] },
];

// Added with the café shop: beans, mugs and merch
const GRINDS = [
  { id: "whole", label: "Whole beans", price: 0 },
  { id: "espresso", label: "Ground for espresso", price: 0 },
  { id: "filter", label: "Ground for pour-over / filter", price: 0 },
  { id: "french-press", label: "Ground for French press", price: 0 },
  { id: "south-indian", label: "South Indian filter (with chicory)", price: 30 },
];
export const MENU_SHOP: MenuItem[] = [
  { id: "house-blend-beans", cat: "shop", name: "House Blend Beans · 250 g", desc: "Our everyday espresso: chocolate, caramel and a little cherry. Roasted this week.", price: 650, img: "1559056199-641a0ac8b55e", badge: "bestseller", variants: GRINDS, stock: 40, cost: 260 },
  { id: "single-origin-beans", cat: "shop", name: "Chikmagalur Single Origin · 250 g", desc: "Bright, fruity and floral. Lovely as a pour-over.", price: 780, img: "1587734195503-904fca47e0e9", variants: GRINDS, stock: 25, cost: 330 },
  { id: "moss-mug", cat: "shop", name: "Moss & Moon Ceramic Mug", desc: "Hand-glazed, 300 ml, dishwasher safe.", price: 450, img: "1514228742587-6b1558fcca3d", variants: [{ id: "cream", label: "Cream", price: 0 }, { id: "blush", label: "Blush pink", price: 0 }, { id: "moss", label: "Moss green", price: 0 }], stock: 30, cost: 180 },
  { id: "keep-cup", cat: "shop", name: "Reusable Coffee Cup", desc: "Bring it back and get ₹10 off every drink.", price: 550, img: "1577937927133-66ef06acdf18", stock: 30, cost: 220 },
  { id: "tote", cat: "shop", name: "Canvas Tote Bag", desc: "Heavy cotton with our little moon on the front.", price: 350, img: "1544816155-12df9643f363", stock: 50, cost: 120 },
  { id: "home-brew-kit", cat: "shop", name: "Home Brew Kit", desc: "Hand grinder, enamel mug and a bag of House Blend. Everything to start.", price: 2400, img: "1611854779393-1b2da9d400fe", badge: "new", stock: 10, cost: 1300 },
  { id: "gift-box", cat: "shop", name: "Moss & Moon Gift Box", desc: "Beans, a mug and four brown butter cookies, wrapped in pink.", price: 1200, img: "1549465220-1a8b9238cd48", badge: "pink pick", variants: [{ id: "house", label: "With House Blend", price: 0 }, { id: "single", label: "With Single Origin", price: 130 }], stock: 15, cost: 560 },
];

/** The full starting menu for a brand-new café */
export const SEED_MENU: MenuItem[] = [...BASE_MENU, ...MENU_V2, ...MENU_SHOP];

// Added later: more coffee, Goan and Indian favourites, bakes and things to take home
export const MENU_V3: MenuItem[] = [
  // Coffee
  { id: "filter-kaapi", cat: "coffee", name: "Filter Kaapi", desc: "South Indian decoction with chicory, frothed with hot milk and jaggery.", price: 140, img: "1551030173-122aabc4489c", badge: "new", traits: { energy: 2, sweet: 1, temp: "hot" }, allergens: [], kcal: 130, nameHi: "फ़िल्टर कापी", descHi: "चिकोरी वाली दक्षिण भारतीय कॉफ़ी, गरम झागदार दूध और गुड़ के साथ।" },
  { id: "spanish-latte", cat: "coffee", name: "Spanish Latte", desc: "Double espresso, milk and a ribbon of condensed milk.", price: 240, img: "1570968915860-54d5c301fa9f", traits: { energy: 1, sweet: 2, temp: "hot" }, allergens: [], kcal: 260, nameHi: "स्पैनिश लाटे", descHi: "डबल एस्प्रेसो, दूध और गाढ़े मीठे दूध की धार।" },
  { id: "flat-white", cat: "coffee", name: "Flat White", desc: "Ristretto shots under a thin layer of velvety milk.", price: 210, img: "1485808191679-5f86510681a2", diet: ["gf"], traits: { energy: 2, sweet: 0, temp: "hot" }, allergens: [], kcal: 120, nameHi: "फ़्लैट व्हाइट", descHi: "रिस्ट्रेटो शॉट पर मखमली दूध की पतली परत।" },
  { id: "hazelnut-latte", cat: "coffee", name: "Hazelnut Latte", desc: "Espresso, steamed milk and toasted hazelnut syrup.", price: 240, img: "1534778101976-62847782c213", traits: { energy: 1, sweet: 2, temp: "hot" }, allergens: ["nuts"], kcal: 230, nameHi: "हेज़लनट लाटे", descHi: "एस्प्रेसो, भाप वाला दूध और भुने हेज़लनट का सिरप।" },
  { id: "mocha", cat: "coffee", name: "Café Mocha", desc: "Espresso and dark chocolate with steamed milk.", price: 230, img: "1611564494260-6f21b80af7ea", traits: { energy: 1, sweet: 2, temp: "hot" }, allergens: ["soy"], kcal: 290, nameHi: "कैफ़े मोका", descHi: "एस्प्रेसो और डार्क चॉकलेट, भाप वाले दूध के साथ।" },
  { id: "affogato", cat: "coffee", name: "Affogato", desc: "A scoop of vanilla gelato drowned in a hot espresso shot.", price: 220, img: "1563805042-7684c019e1cb", diet: ["gf"], noMilk: true, traits: { energy: 1, sweet: 2, temp: "hot" }, allergens: ["milk", "egg"], kcal: 210, cost: 40, nameHi: "अफ़ोगाटो", descHi: "वनीला जेलाटो पर गरम एस्प्रेसो का शॉट।" },
  // Tea
  { id: "kahwa", cat: "tea", name: "Kashmiri Kahwa", desc: "Green tea with saffron, cardamom, cinnamon and slivered almonds.", price: 180, img: "1571934811356-5cc061b6821f", diet: ["vegan", "gf"], noMilk: true, traits: { energy: 0, sweet: 1, temp: "hot" }, allergens: ["nuts"], kcal: 45, cost: 30, nameHi: "कश्मीरी कहवा", descHi: "केसर, इलायची, दालचीनी और बादाम वाली हरी चाय।" },
  { id: "ginger-lemon-honey", cat: "tea", name: "Ginger Lemon Honey", desc: "Fresh ginger and lemon steeped hot, sweetened with honey.", price: 150, img: "1597318181409-cf64d0b5d8a2", diet: ["gf"], noMilk: true, traits: { energy: 0, sweet: 1, temp: "hot" }, allergens: [], kcal: 60, cost: 18, nameHi: "अदरक नींबू शहद", descHi: "ताज़ा अदरक और नींबू, शहद के साथ।" },
  { id: "hibiscus-tea", cat: "tea", name: "Hibiscus Rose Tea", desc: "Tart hibiscus and rose petals, ruby red. Lovely iced too.", price: 170, img: "1558160074-4d7d8bdf4256", diet: ["vegan", "gf"], noMilk: true, badge: "pink pick", traits: { energy: 0, sweet: 1, temp: "hot" }, allergens: [], kcal: 20, cost: 15, nameHi: "गुड़हल गुलाब चाय", descHi: "खट्टी-मीठी गुड़हल और गुलाब की पंखुड़ियाँ।" },
  // Cold drinks
  { id: "vietnamese-iced", cat: "cold", name: "Vietnamese Iced Coffee", desc: "Strong drip coffee over condensed milk and ice. Stir it up.", price: 230, img: "1535958636474-b021ee887b13", noMilk: true, traits: { energy: 2, sweet: 2, temp: "iced" }, allergens: ["milk"], kcal: 220, uses: [{ ingredient: "espresso-beans", amount: 20 }], nameHi: "वियतनामी आइस्ड कॉफ़ी", descHi: "गाढ़े मीठे दूध और बर्फ़ पर तेज़ कॉफ़ी।" },
  { id: "cold-coffee", cat: "cold", name: "Indian Cold Coffee", desc: "Blended frothy with milk, sugar and ice, the way it's done at home.", price: 190, img: "1578314675249-a6910f80cc4e", badge: "bestseller", traits: { energy: 1, sweet: 2, temp: "iced" }, allergens: [], kcal: 280, nameHi: "कोल्ड कॉफ़ी", descHi: "दूध, चीनी और बर्फ़ के साथ फेंटी हुई झागदार कॉफ़ी।" },
  { id: "kokum-soda", cat: "cold", name: "Kokum Soda", desc: "Goan kokum syrup, lime, a pinch of cumin and soda.", price: 150, img: "1563227812-0ea4c22e6cc8", diet: ["vegan", "gf"], noMilk: true, badge: "new", traits: { energy: 0, sweet: 1, temp: "iced" }, allergens: [], kcal: 90, cost: 25, nameHi: "कोकम सोडा", descHi: "गोवा का कोकम, नींबू, ज़रा सा जीरा और सोडा।" },
  { id: "sol-kadhi", cat: "cold", name: "Sol Kadhi", desc: "Chilled kokum and coconut milk with garlic and coriander. Very Goan.", price: 160, img: "1600718374662-0483d2b9da44", diet: ["vegan", "gf"], noMilk: true, traits: { energy: 0, sweet: 0, temp: "iced" }, allergens: [], kcal: 140, cost: 30, nameHi: "सोल कढ़ी", descHi: "कोकम और नारियल के दूध का ठंडा पेय, लहसुन और धनिया के साथ।" },
  { id: "watermelon-cooler", cat: "cold", name: "Watermelon Mint Cooler", desc: "Fresh watermelon, mint and lime, blended and poured over ice.", price: 180, img: "1499638673689-79a0b5115d87", diet: ["vegan", "gf"], noMilk: true, traits: { energy: 0, sweet: 1, temp: "iced" }, allergens: [], kcal: 100, cost: 35, nameHi: "तरबूज़ पुदीना कूलर", descHi: "ताज़ा तरबूज़, पुदीना और नींबू, बर्फ़ पर।" },
  { id: "nutella-shake", cat: "cold", name: "Nutella Freakshake", desc: "Nutella, milk and vanilla gelato, topped with cream and chocolate.", price: 290, img: "1577805947697-89e18249d767", noMilk: true, traits: { energy: 0, sweet: 2, temp: "iced" }, allergens: ["milk", "nuts", "soy"], kcal: 640, cost: 70, nameHi: "न्यूटेला फ़्रीकशेक", descHi: "न्यूटेला, दूध और जेलाटो, ऊपर क्रीम और चॉकलेट।" },
  // Food
  { id: "chorizo-pao", cat: "food", name: "Goan Chorizo Pão", desc: "Spicy Goan chorizo, onions and potato in a soft poi bun.", price: 260, img: "1561758033-d89a9ad46330", badge: "new", allergens: ["gluten"], kcal: 520, cost: 85, addons: [EGG, CHEESE, COMBO_CHAI], nameHi: "गोअन चोरिज़ो पाव", descHi: "तीखा गोअन चोरिज़ो, प्याज़ और आलू, नरम पोई में।" },
  { id: "akuri-toast", cat: "food", name: "Akuri on Toast", desc: "Parsi-style spiced scrambled eggs with tomato and coriander on sourdough.", price: 240, img: "1513442542250-854d436a73f2", allergens: ["gluten", "egg", "milk"], kcal: 430, cost: 50, addons: [CHEESE, GF_BREAD, COMBO_CHAI], nameHi: "अकूरी टोस्ट", descHi: "पारसी ढंग के मसालेदार अंडे, टमाटर और धनिया, सावरडो पर।" },
  { id: "mushroom-benedict", cat: "food", name: "Mushroom Benedict", desc: "Poached eggs and garlic mushrooms on sourdough, with hollandaise.", price: 320, img: "1608039829572-78524f79c4c7", allergens: ["gluten", "egg", "milk"], kcal: 560, cost: 90, addons: [GF_BREAD, COMBO_COFFEE], nameHi: "मशरूम बेनेडिक्ट", descHi: "पोच्ड अंडे और लहसुनी मशरूम, सावरडो पर हॉलैंडेज़ के साथ।" },
  { id: "paneer-wrap", cat: "food", name: "Paneer Tikka Wrap", desc: "Charred tikka paneer, pickled onion and mint chutney in a soft wrap.", price: 260, img: "1626700051175-6818013e1d4f", allergens: ["gluten", "milk"], kcal: 540, cost: 75, addons: [CHEESE, COMBO_CHAI], nameHi: "पनीर टिक्का रैप", descHi: "तंदूरी पनीर, सिरके वाला प्याज़ और पुदीने की चटनी।" },
  { id: "mezze-bowl", cat: "food", name: "Mezze Bowl", desc: "Hummus, falafel, herby quinoa, pickles and warm pita.", price: 340, img: "1547592180-85f173990554", diet: ["vegan"], allergens: ["gluten", "sesame"], kcal: 610, cost: 105, addons: [{ id: "feta", label: "Crumbled feta", price: 50, kcal: 90, adds: ["milk"] }, { id: "gf-no-pita", label: "No pita (gluten-free)", price: 0, removes: ["gluten"] }], nameHi: "मेज़े बाउल", descHi: "हम्मस, फ़लाफ़ेल, किनोआ, अचार और गरम पीटा।" },
  { id: "kids-french-toast", cat: "food", name: "Kids' French Toast Fingers", desc: "Little cinnamon French toast soldiers with banana and honey. For under-10s.", price: 180, img: "1484723091739-30a097e8f929", allergens: ["gluten", "egg", "milk"], kcal: 380, cost: 35, nameHi: "बच्चों का फ़्रेंच टोस्ट", descHi: "केला और शहद के साथ दालचीनी फ़्रेंच टोस्ट। 10 साल से छोटों के लिए।" },
  // Bakes
  { id: "bebinca", cat: "bakes", name: "Bebinca", desc: "Goa's sixteen-layer coconut and egg cake, baked slowly, layer by layer.", price: 180, img: "1586985289688-ca3cf47d3e6e", badge: "pink pick", allergens: ["egg", "milk"], kcal: 360, cost: 55, nameHi: "बेबिंका", descHi: "गोवा का परतदार नारियल और अंडे का केक, धीरे-धीरे परत दर परत बना।" },
  { id: "nutella-crepe", cat: "bakes", name: "Nutella & Banana Crêpe", desc: "A thin French crêpe folded around Nutella and banana.", price: 220, img: "1519676867240-f03562e64548", allergens: ["gluten", "egg", "milk", "nuts", "soy"], kcal: 480, cost: 50, nameHi: "न्यूटेला केला क्रेप", descHi: "पतला फ़्रेंच क्रेप, न्यूटेला और केले के साथ।" },
  { id: "cinnamon-roll", cat: "bakes", name: "Cinnamon Roll", desc: "Soft swirled bun with brown-sugar cinnamon and cream cheese icing.", price: 170, img: "1509365465985-25d11c17e812", allergens: ["gluten", "milk", "egg"], kcal: 420, cost: 35, nameHi: "सिनामन रोल", descHi: "दालचीनी और ब्राउन शुगर वाला नरम बन, क्रीम चीज़ आइसिंग के साथ।" },
  { id: "pink-velvet", cat: "bakes", name: "Pink Velvet Cake", desc: "Strawberry sponge, vanilla buttercream and sprinkles. A slice of joy.", price: 240, img: "1621303837174-89787a7d4729", badge: "new", allergens: ["gluten", "milk", "egg"], kcal: 450, cost: 55, nameHi: "पिंक वेलवेट केक", descHi: "स्ट्रॉबेरी स्पंज, वनीला क्रीम और रंग-बिरंगे स्प्रिंकल्स।" },
  { id: "raspberry-almond-cake", cat: "bakes", name: "Raspberry Almond Cake", desc: "Flourless almond sponge layered with raspberries and cream. Gluten-free.", price: 260, img: "1565958011703-44f9829ba187", diet: ["gf"], allergens: ["nuts", "milk", "egg"], kcal: 400, cost: 70, nameHi: "रास्पबेरी बादाम केक", descHi: "बिना मैदे का बादाम स्पंज, रास्पबेरी और क्रीम के साथ।" },
  { id: "vegan-muffin", cat: "bakes", name: "Vegan Blueberry Muffin", desc: "Fluffy, fruity and completely plant-based, with a crunchy top.", price: 130, img: "1607958996333-41aef7caefaa", diet: ["vegan"], allergens: ["gluten"], kcal: 330, cost: 25, nameHi: "वीगन ब्लूबेरी मफ़िन", descHi: "पूरी तरह पौधों से बना, फलों से भरा मफ़िन।" },
  // Shop
  { id: "drip-bags", cat: "shop", name: "Drip Coffee Bags · pack of 10", desc: "Our House Blend in hang-over-the-cup filters. Just add hot water.", price: 450, img: "1497935586351-b67a49e012bf", stock: 30, cost: 180, nameHi: "ड्रिप कॉफ़ी बैग (10)", descHi: "कप पर लटकाकर बनाइए, बस गरम पानी डालिए।" },
  { id: "cold-brew-bottle", cat: "shop", name: "Cold Brew Concentrate · 1 L", desc: "Makes about 8 drinks: mix one part with two of milk or water over ice.", price: 690, img: "1509785307050-d4066910ec1e", stock: 12, cost: 260, nameHi: "कोल्ड ब्रू कॉन्सन्ट्रेट (1 लीटर)", descHi: "लगभग 8 ड्रिंक: एक भाग में दो भाग दूध या पानी मिलाइए।" },
  { id: "milk-pitcher", cat: "shop", name: "Latte Art Milk Pitcher", desc: "350 ml stainless steel jug with a sharp spout, for hearts at home.", price: 790, img: "1550583724-b2692b85b150", stock: 15, cost: 350, nameHi: "लाटे आर्ट मिल्क पिचर", descHi: "350 मि.ली. स्टील जग, घर पर लाटे आर्ट के लिए।" },
];

// Build your own, tasting flights and the kids' menu
export const MENU_V4: MenuItem[] = [
  {
    id: "build-bowl", cat: "food", name: "Build Your Own Bowl", desc: "Pick a base, a protein, up to three toppings and a sauce.", price: 240, img: "1540189549336-e6e99c3679fe", badge: "new", allergens: [], kcal: 0, cost: 85,
    groups: [
      { id: "base", label: "Base", min: 1, max: 1, choices: [{ id: "quinoa", label: "Herby quinoa", price: 0, kcal: 180 }, { id: "brown-rice", label: "Brown rice", price: 0, kcal: 200 }, { id: "greens", label: "Big leafy greens", price: 0, kcal: 30 }] },
      { id: "protein", label: "Protein", min: 1, max: 1, choices: [{ id: "chickpeas", label: "Spiced chickpeas", price: 0, kcal: 150 }, { id: "paneer", label: "Grilled paneer", price: 40, kcal: 220, adds: ["milk"] }, { id: "tofu", label: "Sesame tofu", price: 40, kcal: 160, adds: ["soy", "sesame"] }, { id: "egg", label: "Two soft eggs", price: 30, kcal: 140, adds: ["egg"] }] },
      { id: "toppings", label: "Toppings · up to 3", min: 0, max: 3, choices: [{ id: "roast-veg", label: "Roast veg", price: 0, kcal: 60 }, { id: "avocado", label: "Avocado", price: 40, kcal: 120 }, { id: "pickled-onion", label: "Pickled onion", price: 0, kcal: 10 }, { id: "corn", label: "Charred corn", price: 0, kcal: 60 }, { id: "feta", label: "Feta", price: 40, kcal: 90, adds: ["milk"] }, { id: "seeds", label: "Toasted seeds", price: 20, kcal: 70, adds: ["sesame"] }] },
      { id: "sauce", label: "Sauce", min: 1, max: 1, choices: [{ id: "tahini", label: "Lemon tahini", price: 0, kcal: 90, adds: ["sesame"] }, { id: "green-goddess", label: "Green goddess (yogurt)", price: 0, kcal: 70, adds: ["milk"] }, { id: "chilli-lime", label: "Chilli lime", price: 0, kcal: 40 }] },
    ],
    nameHi: "अपना बाउल बनाइए", descHi: "बेस, प्रोटीन, तीन टॉपिंग और सॉस चुनिए।",
  },
  {
    id: "build-sandwich", cat: "food", name: "Build Your Own Sandwich", desc: "Your bread, your fillings, pressed or cold.", price: 190, img: "1509722747041-616f39b57569", allergens: ["gluten"], kcal: 260, cost: 55,
    groups: [
      { id: "bread", label: "Bread", min: 1, max: 1, choices: [{ id: "sourdough", label: "Sourdough", price: 0 }, { id: "multigrain", label: "Multigrain", price: 0, adds: ["sesame"] }, { id: "gf", label: "Gluten-free bread", price: 50, removes: ["gluten"] }] },
      { id: "fillings", label: "Fillings · up to 2", min: 1, max: 2, choices: [{ id: "cheddar", label: "Cheddar", price: 0, kcal: 120, adds: ["milk"] }, { id: "egg-mayo", label: "Egg mayo", price: 0, kcal: 160, adds: ["egg"] }, { id: "paneer-bhurji", label: "Paneer bhurji", price: 30, kcal: 180, adds: ["milk"] }, { id: "mushroom", label: "Garlic mushroom", price: 20, kcal: 70 }, { id: "hummus", label: "Hummus & roast veg", price: 20, kcal: 140, adds: ["sesame"] }] },
      { id: "extras", label: "Extras", min: 0, max: 4, choices: [{ id: "tomato", label: "Tomato", price: 0, kcal: 5 }, { id: "onion", label: "Red onion", price: 0, kcal: 5 }, { id: "jalapeno", label: "Jalapeños", price: 0, kcal: 5 }, { id: "mint-chutney", label: "Mint chutney", price: 0, kcal: 15 }, { id: "extra-cheese", label: "Extra cheese", price: 40, kcal: 110, adds: ["milk"] }] },
      { id: "style", label: "How", min: 1, max: 1, choices: [{ id: "toasted", label: "Toasted & pressed", price: 0 }, { id: "cold", label: "Cold", price: 0 }] },
    ],
    nameHi: "अपना सैंडविच बनाइए", descHi: "अपनी ब्रेड और भरावन चुनिए, सेंका हुआ या ठंडा।",
  },
  {
    id: "coffee-flight", cat: "coffee", name: "Coffee Tasting Flight", desc: "Three small cups side by side. Find your favourite.", price: 360, img: "1498804103079-a6351b050096", badge: "new", allergens: [], kcal: 120, uses: [{ ingredient: "espresso-beans", amount: 40 }],
    groups: [{ id: "cups", label: "Pick 3", min: 3, max: 3, choices: [{ id: "espresso", label: "Espresso", price: 0 }, { id: "cortado", label: "Cortado", price: 0, adds: ["milk"] }, { id: "flat-white", label: "Flat white", price: 0, adds: ["milk"] }, { id: "v60", label: "V60 single origin", price: 0 }, { id: "cold-brew", label: "Cold brew", price: 0 }, { id: "kaapi", label: "Filter kaapi", price: 0, adds: ["milk"] }] }],
    nameHi: "कॉफ़ी टेस्टिंग फ़्लाइट", descHi: "तीन छोटे कप साथ-साथ, अपनी पसंद ढूँढिए।",
  },
  {
    id: "matcha-flight", cat: "tea", name: "Matcha Flight", desc: "Three ways with ceremonial matcha, in little cups.", price: 420, img: "1582793988951-9aed5509eb97", badge: "pink pick", allergens: [], kcal: 200, uses: [{ ingredient: "matcha", amount: 8 }, { ingredient: "milk", amount: 150 }],
    groups: [{ id: "cups", label: "Pick 3", min: 3, max: 3, choices: [{ id: "usucha", label: "Straight (usucha)", price: 0 }, { id: "honey-latte", label: "Honey matcha latte", price: 0, adds: ["milk"] }, { id: "strawberry", label: "Iced strawberry matcha", price: 0, adds: ["milk"] }, { id: "coconut", label: "Coconut matcha", price: 0 }, { id: "hojicha", label: "Hojicha latte", price: 0, adds: ["milk"] }] }],
    nameHi: "माचा फ़्लाइट", descHi: "सेरेमोनियल माचा के तीन रूप, छोटे कपों में।",
  },
  {
    id: "mocktail-flight", cat: "cold", name: "Mocktail Flight", desc: "Three mini mocktails to share (or not).", price: 340, img: "1622597467836-f3285f2131b8", diet: ["vegan", "gf"], noMilk: true, allergens: [], kcal: 200,
    groups: [{ id: "glasses", label: "Pick 3", min: 3, max: 3, choices: [{ id: "kokum", label: "Kokum soda", price: 0 }, { id: "mojito", label: "Strawberry mint mojito", price: 0 }, { id: "fizz", label: "Blackberry ginger fizz", price: 0 }, { id: "passionfruit", label: "Passionfruit lemonade", price: 0 }, { id: "watermelon", label: "Watermelon mint cooler", price: 0 }] }],
    nameHi: "मॉकटेल फ़्लाइट", descHi: "तीन छोटे मॉकटेल, बाँटने के लिए (या नहीं)।",
  },
  // Kids
  { id: "kids-pancakes", cat: "food", name: "Kids' Mini Pancakes", desc: "Five little pancakes with banana, berries and a drizzle of honey.", price: 170, img: "1528207776546-365bb710ee93", kids: true, allergens: ["gluten", "milk", "egg"], kcal: 360, cost: 35, nameHi: "बच्चों के मिनी पैनकेक", descHi: "पाँच छोटे पैनकेक, केला, बेरी और शहद के साथ।" },
  { id: "babyccino", cat: "tea", name: "Babyccino", desc: "Warm frothy milk with cocoa dust and a marshmallow. No caffeine.", price: 70, img: "1542990253-0d0f5be5f0ed", kids: true, traits: { energy: 0, sweet: 1, temp: "hot" }, allergens: [], kcal: 110, uses: [{ ingredient: "milk", amount: 120 }], nameHi: "बेबीचीनो", descHi: "कोको वाला गरम झागदार दूध और एक मार्शमैलो। कैफ़ीन नहीं।" },
  { id: "kids-milk", cat: "cold", name: "Kids' Chocolate Milk", desc: "Cold milk shaken with real cocoa. Plain milk if you'd rather.", price: 110, img: "1517448931760-9bf4414148c5", kids: true, traits: { energy: 0, sweet: 2, temp: "iced" }, allergens: ["milk"], noMilk: true, kcal: 180, uses: [{ ingredient: "milk-whole", amount: 200 }], nameHi: "बच्चों का चॉकलेट दूध", descHi: "असली कोको के साथ ठंडा दूध।" },
];
/** Existing dishes that also come as a half portion, and the kids' items from before */
export const HALF_PORTIONS = ["penne-arrabbiata", "pesto-pasta", "buddha-bowl", "margherita-flatbread", "pancakes", "mezze-bowl", "granola-bowl"];
export const KIDS_ITEMS = ["kids-french-toast"];

// Breakfast, wellness, Goan specials and desserts
export const MENU_V5: MenuItem[] = [
  // Drinks
  { id: "iced-hojicha", cat: "tea", name: "Iced Hojicha Latte", desc: "Roasted Japanese green tea, toasty and low in caffeine, over milk and ice.", price: 250, img: "1558857563-b371033873b8", badge: "new", traits: { energy: 0, sweet: 1, temp: "iced" }, allergens: [], kcal: 160, uses: [{ ingredient: "tea-leaves", amount: 4 }, { ingredient: "milk", amount: 180 }], nameHi: "आइस्ड होजिचा लाटे", descHi: "भुनी हुई जापानी हरी चाय, दूध और बर्फ़ के साथ। कम कैफ़ीन।" },
  { id: "turmeric-latte", cat: "tea", name: "Turmeric Honey Latte", desc: "Haldi doodh, our way: turmeric, ginger, black pepper and honey in warm milk.", price: 190, img: "1587049352851-8d4e89133924", diet: ["gf"], traits: { energy: 0, sweet: 1, temp: "hot" }, allergens: [], kcal: 170, uses: [{ ingredient: "milk", amount: 200 }], nameHi: "हल्दी शहद लाटे", descHi: "हल्दी दूध: हल्दी, अदरक, काली मिर्च और शहद, गरम दूध में।" },
  { id: "juice-of-the-day", cat: "cold", name: "Cold-Pressed Juice of the Day", desc: "Whatever's best at the market this morning. Ask what's in it today.", price: 200, img: "1603569283847-aa295f0d016a", diet: ["vegan", "gf"], noMilk: true, traits: { energy: 0, sweet: 1, temp: "iced" }, allergens: [], kcal: 130, cost: 55, nameHi: "आज का ताज़ा जूस", descHi: "आज सुबह बाज़ार में जो सबसे अच्छा मिला। पूछिए आज क्या है।" },
  { id: "nimbu-pani", cat: "cold", name: "Nimbu Pani", desc: "Fresh lime, roasted cumin and black salt. Sweet, salted or both.", price: 110, img: "1546171753-97d7676e4602", diet: ["vegan", "gf"], noMilk: true, traits: { energy: 0, sweet: 1, temp: "iced" }, allergens: [], kcal: 70, cost: 12, nameHi: "नींबू पानी", descHi: "ताज़ा नींबू, भुना जीरा और काला नमक। मीठा, नमकीन या दोनों।" },
  // Breakfast & food
  { id: "ros-omelette", cat: "food", name: "Goan Ros Omelette", desc: "A fluffy omelette in spicy chicken xacuti gravy, with pão to mop it up.", price: 280, img: "1578020190125-f4f7c18bc9cb", badge: "new", allergens: ["egg", "gluten"], kcal: 520, cost: 75, addons: [CHEESE, COMBO_CHAI], nameHi: "गोअन रोस ऑमलेट", descHi: "तीखी चिकन शकुती ग्रेवी में नरम ऑमलेट, साथ में पाव।" },
  { id: "shakshuka", cat: "food", name: "Shakshuka", desc: "Eggs poached in a smoky tomato and pepper sauce, with sourdough.", price: 300, img: "1510693206972-df098062cb71", allergens: ["egg", "gluten"], kcal: 460, cost: 70, addons: [{ id: "feta", label: "Crumbled feta", price: 50, kcal: 90, adds: ["milk"] }, GF_BREAD, COMBO_COFFEE], half: true, nameHi: "शक्शुका", descHi: "धुएँदार टमाटर और शिमला मिर्च की चटनी में पोच्ड अंडे, सावरडो के साथ।" },
  { id: "omelette-toast", cat: "food", name: "Masala Omelette Toast", desc: "Green chilli, onion and coriander omelette on buttered toast. A street classic.", price: 200, img: "1533089860892-a7c6f0a88666", allergens: ["egg", "gluten", "milk"], kcal: 420, cost: 40, addons: [CHEESE, GF_BREAD, COMBO_CHAI], nameHi: "मसाला ऑमलेट टोस्ट", descHi: "हरी मिर्च, प्याज़ और धनिया वाला ऑमलेट, मक्खन वाले टोस्ट पर।" },
  { id: "idli", cat: "food", name: "Idli & Coconut Chutney", desc: "Four soft steamed rice cakes with coconut chutney and sambar.", price: 180, img: "1589301760014-d929f3979dbc", diet: ["vegan", "gf"], allergens: [], kcal: 320, cost: 35, nameHi: "इडली और नारियल चटनी", descHi: "चार नरम इडली, नारियल चटनी और सांबर के साथ।" },
  { id: "overnight-oats", cat: "food", name: "Overnight Oats", desc: "Oats soaked in oat milk with chia, topped with berries, kiwi and honey.", price: 230, img: "1517673400267-0251440c45dc", diet: ["vegan"], allergens: ["gluten"], kcal: 380, cost: 55, nameHi: "ओवरनाइट ओट्स", descHi: "ओट दूध में भीगे ओट्स और चिया, ऊपर बेरी, कीवी और शहद।" },
  { id: "parfait", cat: "food", name: "Berry Yogurt Parfait", desc: "Layers of thick curd, berry compote and crunchy granola in a glass.", price: 220, img: "1505252585461-04db1eb84625", allergens: ["milk", "gluten", "nuts"], kcal: 340, cost: 50, nameHi: "बेरी योगर्ट पार्फ़े", descHi: "गाढ़े दही, बेरी कॉम्पोट और कुरकुरे ग्रेनोला की परतें।" },
  { id: "kale-salad", cat: "food", name: "Pomegranate Kale Salad", desc: "Kale, avocado, pomegranate, toasted seeds and a lemon honey dressing.", price: 310, img: "1511690743698-d9d85f2fbf38", diet: ["gf"], allergens: ["sesame"], kcal: 360, cost: 95, addons: [{ id: "paneer", label: "Grilled paneer", price: 60, kcal: 160, adds: ["milk"] }], half: true, nameHi: "अनार केल सलाद", descHi: "केल, एवोकाडो, अनार, भुने बीज और नींबू-शहद ड्रेसिंग।" },
  { id: "pea-soup", cat: "food", name: "Pea & Mint Soup", desc: "Bright green, silky and fresh, with a garlic breadstick.", price: 220, img: "1626200419199-391ae4be7a41", diet: ["vegan"], allergens: ["gluten"], kcal: 260, cost: 40, half: true, nameHi: "मटर और पुदीना सूप", descHi: "चमकीला हरा, मुलायम सूप, लहसुनी ब्रेडस्टिक के साथ।" },
  { id: "xacuti-pie", cat: "food", name: "Mushroom Xacuti Pie", desc: "Mushrooms in Goan xacuti spices under a buttery lattice crust.", price: 280, img: "1535920527002-b35e96722eb9", allergens: ["gluten", "milk"], kcal: 540, cost: 70, nameHi: "मशरूम शकुती पाई", descHi: "गोअन शकुती मसालों वाले मशरूम, मक्खनी जालीदार परत के नीचे।" },
  { id: "balchao-toast", cat: "food", name: "Prawn Balchão Toast", desc: "Goa's tangy, fiery prawn pickle-curry on toasted pão.", price: 340, img: "1559737558-2f5a35f4523b", allergens: ["gluten", "shellfish"], kcal: 430, cost: 120, nameHi: "झींगा बालचाओ टोस्ट", descHi: "गोवा का खट्टा-तीखा झींगा बालचाओ, सिके पाव पर। इसमें शेलफ़िश है।" },
  { id: "paneer-burger", cat: "food", name: "Crispy Paneer Burger", desc: "Spiced crumbed paneer, slaw and chipotle mayo in a brioche bun.", price: 290, img: "1571091718767-18b5b1457add", allergens: ["gluten", "milk", "egg"], kcal: 620, cost: 80, addons: [CHEESE, COMBO_COFFEE], nameHi: "क्रिस्पी पनीर बर्गर", descHi: "मसालेदार क्रिस्पी पनीर, स्लॉ और चिपोटले मेयो, ब्रिओश बन में।" },
  // Desserts
  { id: "serradura", cat: "bakes", name: "Serradura", desc: "Goa's 'sawdust pudding': layers of whipped cream and crumbled Marie biscuit.", price: 200, img: "1571115177098-24ec42ed204d", badge: "pink pick", allergens: ["milk", "gluten"], kcal: 380, cost: 40, nameHi: "सेराडुरा", descHi: "गोवा का 'बुरादा पुडिंग': व्हीप्ड क्रीम और मैरी बिस्किट की परतें।" },
  { id: "black-forest", cat: "bakes", name: "Black Forest Cake", desc: "Chocolate sponge, cherries and cream, with dark chocolate curls.", price: 260, img: "1606890737304-57a1ca8a5b62", allergens: ["gluten", "milk", "egg"], kcal: 460, cost: 55, nameHi: "ब्लैक फ़ॉरेस्ट केक", descHi: "चॉकलेट स्पंज, चेरी और क्रीम, डार्क चॉकलेट के साथ।" },
  {
    id: "gelato-cup", cat: "bakes", name: "Gelato Cup", desc: "Two scoops, made here. Cup or cone.", price: 180, img: "1501443762994-82bd5dace89a", allergens: ["milk"], kcal: 0, cost: 40,
    groups: [
      { id: "flavours", label: "Pick 2 scoops", min: 2, max: 2, choices: [{ id: "vanilla", label: "Madagascar vanilla", price: 0, kcal: 130 }, { id: "chocolate", label: "Dark chocolate", price: 0, kcal: 150, adds: ["soy"] }, { id: "pistachio", label: "Pistachio", price: 20, kcal: 150, adds: ["nuts"] }, { id: "mango", label: "Alphonso mango sorbet", price: 0, kcal: 100 }, { id: "rose", label: "Rose & strawberry", price: 0, kcal: 120 }] },
      { id: "how", label: "In a", min: 1, max: 1, choices: [{ id: "cup", label: "Cup", price: 0 }, { id: "cone", label: "Waffle cone", price: 20, kcal: 60, adds: ["gluten", "egg"] }] },
    ],
    nameHi: "जेलाटो कप", descHi: "दो स्कूप, यहीं बना। कप या कोन में।",
  },
  { id: "rose-kulfi", cat: "bakes", name: "Rose Kulfi", desc: "Slow-reduced milk kulfi with rose and pistachio, on a stick.", price: 120, img: "1505394033641-40c6ad1178d7", diet: ["gf"], allergens: ["milk", "nuts"], kcal: 210, cost: 25, kids: true, nameHi: "गुलाब कुल्फ़ी", descHi: "धीमे पकाए दूध की कुल्फ़ी, गुलाब और पिस्ता के साथ, डंडी पर।" },
  { id: "brownie-sundae", cat: "bakes", name: "Brownie Sundae", desc: "Warm fudge brownie, vanilla gelato, salted caramel and a wafer.", price: 270, img: "1551024506-0bccd828d307", allergens: ["gluten", "milk", "egg", "soy"], kcal: 680, cost: 60, nameHi: "ब्राउनी संडे", descHi: "गरम ब्राउनी, वनीला जेलाटो, नमकीन कैरमल और वेफ़र।" },
  // Shop
  {
    id: "gift-hamper", cat: "shop", name: "Build a Gift Hamper", desc: "A pink box with ribbon and a handwritten card. Pick the coffee and up to three treats.", price: 300, img: "1501747315-124a0eaca060", badge: "pink pick", stock: 15, cost: 650,
    groups: [
      { id: "coffee", label: "The coffee", min: 1, max: 1, choices: [{ id: "drip", label: "Drip bags (10)", price: 450 }, { id: "house", label: "House Blend 250 g", price: 650 }, { id: "mystery", label: "Mystery Bean 250 g", price: 720 }, { id: "single", label: "Single Origin 250 g", price: 780 }] },
      { id: "treats", label: "Treats & things · up to 3", min: 0, max: 3, choices: [{ id: "mug", label: "Ceramic mug", price: 450 }, { id: "cup", label: "Reusable cup", price: 550 }, { id: "tote", label: "Canvas tote", price: 350 }, { id: "macarons", label: "Rose macarons (4)", price: 260, adds: ["nuts", "egg", "milk"] }, { id: "cookies", label: "Brown butter cookies (4)", price: 380, adds: ["gluten", "milk", "egg", "soy"] }, { id: "bebinca", label: "Bebinca slab", price: 500, adds: ["egg", "milk"] }] },
    ],
    nameHi: "गिफ़्ट हैंपर बनाइए", descHi: "रिबन और हाथ से लिखे कार्ड वाला गुलाबी डिब्बा। कॉफ़ी और तीन तोहफ़े चुनिए।",
  },
  { id: "mystery-beans", cat: "shop", name: "Mystery Bean of the Month · 250 g", desc: "A new single origin every month, picked by our head barista. Tasting notes inside.", price: 720, img: "1442550528053-c431ecb55509", badge: "new", variants: GRINDS, stock: 20, cost: 300, nameHi: "महीने की मिस्ट्री बीन्स (250 ग्राम)", descHi: "हर महीने नई सिंगल ओरिजिन कॉफ़ी, हमारे हेड बरिस्ता की पसंद।" },
];

// The seasonal rotation (only one season's items show at a time) and two signatures
export const MENU_V6: MenuItem[] = [
  { id: "mango-cold-brew", cat: "cold", name: "Mango Cold Brew", desc: "Our 18-hour cold brew over Alphonso mango purée and ice. Tastes like May.", price: 240, img: "1553279768-865429fa0078", rotation: "summer", badge: "new", noMilk: true, diet: ["vegan", "gf"], traits: { energy: 2, sweet: 1, temp: "iced" }, allergens: [], kcal: 90, uses: [{ ingredient: "espresso-beans", amount: 22 }], nameHi: "आम कोल्ड ब्रू", descHi: "18 घंटे का कोल्ड ब्रू, अल्फ़ांसो आम और बर्फ़ पर।" },
  { id: "kokum-granita", cat: "cold", name: "Kokum Granita", desc: "Spoonable shaved kokum ice with lime and a pinch of chaat masala.", price: 160, img: "1595981267035-7b04ca84a82d", rotation: "summer", noMilk: true, diet: ["vegan", "gf"], traits: { energy: 0, sweet: 1, temp: "iced" }, allergens: [], kcal: 110, cost: 25, nameHi: "कोकम ग्रानीता", descHi: "नींबू और चाट मसाले वाली कोकम की बर्फ़।" },
  { id: "masala-bhutta", cat: "food", name: "Masala Bhutta", desc: "Charcoal-roasted corn rubbed with lime, chilli and rock salt. Monsoon in one bite.", price: 120, img: "1470119693884-47d3a1d1f180", rotation: "monsoon", diet: ["vegan", "gf"], allergens: [], kcal: 180, cost: 25, nameHi: "मसाला भुट्टा", descHi: "कोयले पर भुना भुट्टा, नींबू, मिर्च और सेंधा नमक के साथ।" },
  { id: "samosa-plate", cat: "food", name: "Chai & Samosa Plate", desc: "Two hot samosas with green chutney and a cutting masala chai.", price: 180, img: "1601050690597-df0568f70950", rotation: "monsoon", badge: "pink pick", diet: ["vegan"], allergens: ["gluten"], kcal: 520, cost: 40, nameHi: "चाय और समोसा", descHi: "दो गरम समोसे, हरी चटनी और कटिंग मसाला चाय।" },
  { id: "pav-bhaji", cat: "food", name: "Pav Bhaji", desc: "Buttery spiced mashed vegetables, toasted pav, onion and lime. A Bombay classic.", price: 240, img: "1606491956689-2ea866880c84", rotation: "monsoon", allergens: ["gluten", "milk"], kcal: 620, cost: 55, half: true, nameHi: "पाव भाजी", descHi: "मक्खन वाली मसालेदार भाजी, सिके पाव, प्याज़ और नींबू के साथ।" },
  { id: "fruit-nut-bark", cat: "bakes", name: "Christmas Fruit & Nut Bark", desc: "Dark chocolate with rum-soaked raisins, orange peel and toasted almonds.", price: 220, img: "1606312619070-d48b4c652a52", rotation: "winter", badge: "new", allergens: ["nuts", "milk", "soy"], kcal: 380, cost: 60, nameHi: "क्रिसमस फ्रूट और नट बार्क", descHi: "डार्क चॉकलेट, किशमिश, संतरे का छिलका और भुने बादाम।" },
  { id: "hot-chocolate", cat: "tea", name: "Hot Chocolate & Marshmallows", desc: "Thick 70% dark hot chocolate, whipped cream and toasted marshmallows.", price: 240, img: "1557142046-c704a3adf364", rotation: "winter", traits: { energy: 0, sweet: 2, temp: "hot" }, allergens: ["soy"], kcal: 380, uses: [{ ingredient: "milk", amount: 220 }], cost: 35, nameHi: "हॉट चॉकलेट और मार्शमैलो", descHi: "गाढ़ी 70% डार्क हॉट चॉकलेट, क्रीम और भुने मार्शमैलो।" },
  { id: "rose-cardamom-latte", cat: "coffee", name: "Rose Cardamom Latte", desc: "Espresso, steamed milk, house rose syrup and a whisper of cardamom. Pink, of course.", price: 250, img: "1514066558159-fc8c737ef259", badge: "pink pick", staffPick: true, traits: { energy: 1, sweet: 2, temp: "hot" }, allergens: [], kcal: 230, nameHi: "गुलाब इलायची लाटे", descHi: "एस्प्रेसो, भाप वाला दूध, गुलाब का सिरप और ज़रा सी इलायची।" },
  { id: "coconut-espresso", cat: "cold", name: "Coconut Espresso", desc: "A double shot poured over tender coconut water and ice. Light, nutty, very Goan.", price: 220, img: "1610889556528-9a770e32642f", badge: "new", noMilk: true, diet: ["vegan", "gf"], traits: { energy: 2, sweet: 1, temp: "iced" }, allergens: [], kcal: 60, uses: [{ ingredient: "espresso-beans", amount: 18 }], nameHi: "कोकोनट एस्प्रेसो", descHi: "नारियल पानी और बर्फ़ पर डबल शॉट। हल्का और गोवा जैसा।" },
];

// Filling the thin spots: more to take home, and gluten-free bakes
export const MENU_V7: MenuItem[] = [
  { id: "cold-brew-kit", cat: "shop", name: "Cold Brew at Home Kit", desc: "250 g coarse-ground House Blend, 4 reusable filter bags and our 18-hour recipe card.", price: 890, img: "1511920170033-f8396924c348", badge: "new", stock: 15, cost: 380, nameHi: "घर पर कोल्ड ब्रू किट", descHi: "250 ग्राम कॉफ़ी, 4 फ़िल्टर बैग और हमारी रेसिपी।" },
  { id: "tea-set", cat: "shop", name: "Tea for Two Set", desc: "A hand-glazed teapot and two cups, with a tin of our Rose Masala Chai.", price: 1650, img: "1564890369478-c89ca6d9cde9", stock: 8, cost: 780, variants: [{ id: "cream", label: "Cream", price: 0 }, { id: "blush", label: "Blush pink", price: 0 }], nameHi: "दो लोगों का चाय सेट", descHi: "हाथ से बनी केतली और दो कप, गुलाब मसाला चाय के साथ।" },
  { id: "cafe-candle", cat: "shop", name: "Café Candle · Coffee & Fig", desc: "Soy wax, hand-poured in Goa. Smells like our counter at 8am. About 40 hours.", price: 690, img: "1602874801007-bd458bb1b8b6", badge: "pink pick", stock: 20, cost: 260, nameHi: "कैफ़े कैंडल · कॉफ़ी और अंजीर", descHi: "गोवा में हाथ से बनी सोया वैक्स कैंडल, लगभग 40 घंटे।" },
  { id: "gf-brownie", cat: "bakes", name: "Gluten-Free Fudge Brownie", desc: "Dense, gooey and made with almond flour. Nobody guesses it's gluten-free.", price: 150, img: "1564355808539-22fda35bed7e", diet: ["gf"], allergens: ["nuts", "egg", "milk", "soy"], kcal: 340, cost: 35, nameHi: "ग्लूटेन-फ़्री ब्राउनी", descHi: "बादाम के आटे से बनी, गाढ़ी और नरम ब्राउनी।" },
  { id: "gf-muffin", cat: "bakes", name: "Gluten-Free Berry Crumble Muffin", desc: "Made with rice flour, blueberries and a brown sugar crumble on top.", price: 140, img: "1558303420-f814d8a590f5", diet: ["gf"], allergens: ["egg", "milk"], kcal: 310, cost: 30, nameHi: "ग्लूटेन-फ़्री बेरी मफ़िन", descHi: "ब्लूबेरी और ब्राउन शुगर क्रम्बल वाला ग्लूटेन-फ़्री मफ़िन।" },
];

/** The dish name in the guest's language, falling back to the nearest one we have */
export function itemName(m: Pick<MenuItem, "name" | "nameHi" | "nameMr" | "nameKok">, lang: Lang): string {
  if (lang === "hi") return m.nameHi || m.name;
  if (lang === "mr") return m.nameMr || m.nameHi || m.name;
  if (lang === "kok") return m.nameKok || m.nameMr || m.nameHi || m.name;
  return m.name;
}
