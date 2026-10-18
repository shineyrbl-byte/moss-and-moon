// The starting menu. On first run it is copied into the database; after that,
// staff edit the menu from /admin → Menu (no code changes needed).

export type Category = "coffee" | "tea" | "cold" | "food" | "bakes";

/** Something extra on a food item, e.g. "Add an egg +₹40". adds/removes change its allergens. */
export type Addon = { id: string; label: string; price: number; kcal?: number; adds?: string[]; removes?: string[] };
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
  /** Food add-ons guests can pick (extra cheese, gluten-free bread, make it a combo…) */
  addons?: Addon[];
  /** Drinks made without milk (smoothies, juices, mocktails): no milk choice */
  noMilk?: boolean;
  /** Allergens in the item itself (a drink's milk is added on top, see lib/nutrition.ts) */
  allergens?: ("milk" | "nuts" | "gluten" | "egg" | "soy" | "sesame")[];
  /** Rough calories, regular size as it usually comes */
  kcal?: number;
  /** What one costs to make in ₹, on top of tracked ingredients (e.g. a whole croissant from the bakery) */
  cost?: number;
  /** Festival special: only on the menu during this season (see lib/seasons.ts) */
  season?: string;
  /** Ingredients used per item (leave empty to use sensible defaults for drinks) */
  uses?: { ingredient: string; amount: number }[];
  soldOut?: boolean; // filled in from the database
};

export const photo = (img: string, w = 900) =>
  img.startsWith("/") || img.startsWith("http") ? img : `https://images.unsplash.com/photo-${img}?auto=format&fit=crop&q=75&w=${w}`;

/** Menu tabs: every category, plus "all" and "specials" (new, pink picks and festival drinks) */
export type MenuTab = Category | "all" | "specials";
export const CATEGORY_ORDER: Category[] = ["coffee", "tea", "cold", "food", "bakes"];
export const inTab = (m: Pick<MenuItem, "cat" | "badge" | "season">, tab: MenuTab) =>
  tab === "all" || (tab === "specials" ? m.badge === "new" || m.badge === "pink pick" || !!m.season : m.cat === tab);

export const CATEGORIES: { id: MenuTab; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "specials", label: "Specials" },
  { id: "coffee", label: "Coffee" },
  { id: "tea", label: "Tea & matcha" },
  { id: "cold", label: "Cold drinks" },
  { id: "food", label: "Food" },
  { id: "bakes", label: "Bakes & sweets" },
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

/** The full starting menu for a brand-new café */
export const SEED_MENU: MenuItem[] = [...BASE_MENU, ...MENU_V2];
