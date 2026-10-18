// Drink recipes for the barista screen (staff only, never sent with the public menu)
import "server-only";
import { db } from "./db";

export const SIZE_GUIDE = "Cups: small 240 ml · regular 350 ml · large 470 ml (large gets one extra shot). Espresso: 18 g in, 36 g out, 25–30 s.";

/** Starting recipes, one line per step. The owner can edit them. */
export const SEED_RECIPES: Record<string, string> = {
  "honey-oat-latte": "Pull a double shot over 1 tsp (8 g) wildflower honey; stir.\nSteam 220 ml oat milk to 60 °C, glossy microfoam.\nPour, finish with a heart.",
  "rose-latte": "15 ml rose syrup in the cup, pull a double shot on top; stir.\nSteam 200 ml milk to 60 °C.\nPour, top with 1 tbsp pistachio cream and crushed pistachio + dried rose.",
  "pour-over": "15 g beans, medium-fine. 250 g water at 93 °C.\nRinse the filter, bloom with 40 g for 40 s.\nPour in slow circles to 250 g by 2:00; drawdown by 3:00.",
  cappuccino: "Double shot.\nSteam 150 ml milk to 60 °C with more air (1 cm of foam).\nPour, dust with cocoa.",
  cortado: "Pinch of ground cardamom on the puck before brewing.\nDouble shot into a 120 ml glass.\nTop with 60 ml lightly steamed milk.",
  "iced-brown-sugar": "Double shot + 15 ml brown sugar syrup + a dash of cinnamon in a shaker with ice; shake 10 s.\nStrain over fresh ice, top with 120 ml oat milk.",
  americano: "200 ml hot water (90 °C) in the cup first.\nPull a double shot on top so the crema stays.",
  matcha: "2 g (1 tsp) ceremonial matcha, sifted.\n70 ml water at 80 °C; whisk in an M shape for 20 s until frothy.\nServe in the bowl.",
  "honey-matcha": "Whisk 2 g matcha with 40 ml water at 80 °C.\nAdd 1 tsp honey.\nSteam 220 ml milk to 60 °C and pour over (iced: cold milk over ice, matcha on top).",
  boba: "Cook tapioca pearls 25 min, rest 10, soak in brown sugar syrup.\n3 tbsp pearls + 20 ml syrup swirled up the cup walls.\nIce, 150 ml black tea, 100 ml milk. Wide straw.",
  chai: "Simmer 150 ml water with 2 tsp Assam, crushed ginger, cardamom, clove, 1 tsp dried rose for 3 min.\nAdd 150 ml milk + sugar; bring up twice.\nStrain into the cup.",
  chamomile: "1 tbsp chamomile flowers, 300 ml water at 95 °C, 5 min.\nStrain, stir in 1 tsp honey, lemon slice on the side.",
  oolong: "6 g oolong in the pot, rinse with hot water for 5 s and pour away.\n500 ml water at 90 °C; first steep 1 min. Serve with two cups; refills free.",
  "lemon-iced-tea": "Brew 200 ml strong black tea, cool.\nMuddle 6 mint leaves + 2 lime wedges + 15 ml sugar syrup.\nIce, tea, a splash of soda. Mint sprig.",
  "cold-brew": "Batch: 100 g coarse beans to 1 L cold water, steep 18 h in the fridge, filter twice.\nServe 180 ml over ice; splash of milk if asked.",
  "iced-mocha": "Double shot + 20 ml chocolate sauce; stir until smooth.\nIce, 180 ml cold milk.\nWhipped cream and cocoa on top.",
  "oreo-frappe": "Blender: 1 shot (or 60 ml cold brew), 150 ml milk, 4 Oreos, 20 ml vanilla syrup, 1 cup ice. Blend 25 s.\nWhipped cream, one crushed Oreo.",
  "berry-smoothie": "Blender: 120 g frozen mixed berries, half banana, 150 ml yogurt, 50 ml milk, 1 tsp honey. Blend 30 s.\nNo ice needed.",
  "mango-smoothie": "Blender: 150 g mango pulp, 150 ml yogurt, 50 ml milk, pinch of cardamom, 1 tsp sugar, half cup ice. Blend 25 s.",
  "strawberry-banana": "Blender: 6 strawberries, 1 banana, 150 ml milk, 50 ml yogurt, 1 tsp honey, half cup ice. Blend 30 s.",
  "blackberry-fizz": "Muddle 6 blackberries with 10 ml ginger syrup and a lime wedge.\nIce, top with 200 ml soda; stir gently.\nBlackberry and lime to garnish.",
  "strawberry-mojito": "Muddle 3 strawberries, 8 mint leaves, 2 lime wedges, 15 ml sugar syrup.\nCrushed ice, 200 ml soda. Stir up from the bottom.",
  "passionfruit-lemonade": "30 ml passionfruit pulp + 30 ml lemon juice + 20 ml sugar syrup.\nIce, 200 ml water (or soda if asked). Stir, lemon wheel.",
  "fresh-orange": "Juice 3–4 oranges to 300 ml, fresh to order. No ice unless asked.",
};

export function seedRecipes() {
  const add = db.prepare("INSERT OR IGNORE INTO recipes (item_id, text) VALUES (?, ?)");
  for (const [id, text] of Object.entries(SEED_RECIPES)) add.run(id, text);
}

export const allRecipes = () => Object.fromEntries((db.prepare("SELECT item_id, text FROM recipes").all() as { item_id: string; text: string }[]).map((r) => [r.item_id, r.text]));

export function saveRecipe(itemId: string, text: string) {
  if (text.trim()) db.prepare("INSERT INTO recipes (item_id, text) VALUES (?, ?) ON CONFLICT(item_id) DO UPDATE SET text = excluded.text, updated_at = datetime('now','localtime')").run(itemId, text.trim().slice(0, 2000));
  else db.prepare("DELETE FROM recipes WHERE item_id = ?").run(itemId);
}
