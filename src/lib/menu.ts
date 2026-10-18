// The starting menu. On first run it is copied into the database; after that,
// staff edit the menu from /admin → Menu (no code changes needed).

export type Category = "coffee" | "tea" | "bakes";
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
  /** Festival special: only on the menu during this season (see lib/seasons.ts) */
  season?: string;
  /** Ingredients used per item (leave empty to use sensible defaults for drinks) */
  uses?: { ingredient: string; amount: number }[];
  soldOut?: boolean; // filled in from the database
};

export const photo = (img: string, w = 900) =>
  img.startsWith("/") || img.startsWith("http") ? img : `https://images.unsplash.com/photo-${img}?auto=format&fit=crop&q=75&w=${w}`;

export const CATEGORIES: { id: Category | "all"; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "coffee", label: "Coffee" },
  { id: "tea", label: "Tea & matcha" },
  { id: "bakes", label: "Bakes & sweets" },
];

export const SEED_MENU: MenuItem[] = [
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

