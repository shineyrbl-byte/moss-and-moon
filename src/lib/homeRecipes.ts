// "Make it at home" versions of our drinks, written for a home kitchen (no espresso machine needed).
// Different from the staff recipe book, which is how baristas make them at the counter.
export type HomeRecipe = {
  id: string; // the menu item it copies
  title: string;
  minutes: number;
  makes: string;
  kit: string[];
  ingredients: string[];
  steps: string[];
  tip: string;
};

/** "Espresso" at home, for the recipes below */
export const NO_MACHINE = "No espresso machine? Use 60 ml of very strong coffee: a moka pot, an AeroPress with 18 g of coffee and 60 ml of water, or 2 tsp instant coffee stirred into 60 ml hot water.";

export const HOME_RECIPES: HomeRecipe[] = [
  {
    id: "rose-latte", title: "Rose Pistachio Latte", minutes: 10, makes: "1 mug",
    kit: ["Small saucepan", "Whisk or milk frother"],
    ingredients: ["60 ml espresso or strong coffee", "200 ml milk", "1 tbsp rose syrup (or 1 tsp rose water + 2 tsp sugar)", "1 tbsp pistachios, finely ground", "1 tbsp cream", "Dried rose petals, to finish"],
    steps: ["Whisk the ground pistachios into the cream until thick. Set aside.", "Warm the milk with the rose syrup until steaming (don't let it boil), then froth it.", "Pour the coffee into a mug, then the pink milk over it.", "Spoon the pistachio cream on top and scatter a few rose petals."],
    tip: "Rose goes from lovely to soapy fast. Start with less and add more.",
  },
  {
    id: "honey-oat-latte", title: "Honey Oat Latte", minutes: 5, makes: "1 mug",
    kit: ["Milk frother or a jar with a lid"],
    ingredients: ["60 ml espresso or strong coffee", "200 ml oat milk (a 'barista' one foams best)", "2 tsp honey"],
    steps: ["Stir the honey into the hot coffee so it melts.", "Heat the oat milk until steaming. Froth it, or shake it hard in a jar with the lid on (careful, it's hot).", "Pour the milk over the coffee, holding back the foam with a spoon, then spoon the foam on top."],
    tip: "Wildflower honey has the most flavour. Avoid boiling the oat milk, which makes it go thin.",
  },
  {
    id: "cold-brew", title: "Slow Cold Brew", minutes: 5, makes: "About 4 glasses (makes ahead)",
    kit: ["A large jar", "Sieve and a paper filter or clean cloth"],
    ingredients: ["100 g coffee, coarsely ground (like breadcrumbs)", "1 litre cold water", "Ice and milk, to serve"],
    steps: ["Stir the coffee into the water in the jar until it's all wet.", "Cover and leave in the fridge for 16 to 18 hours.", "Strain through the sieve lined with a filter. Strain twice if it's still gritty.", "Pour over ice, half coffee, half water or milk."],
    tip: "It keeps for a week in the fridge. If it tastes bitter, grind coarser or brew a few hours less.",
  },
  {
    id: "filter-kaapi", title: "Filter Kaapi", minutes: 20, makes: "2 small tumblers",
    kit: ["South Indian coffee filter (or a French press)", "Small saucepan", "Two steel tumblers"],
    ingredients: ["3 tbsp filter coffee powder with chicory", "100 ml just-boiled water", "300 ml full-cream milk", "2 tsp jaggery or sugar"],
    steps: ["Put the powder in the top chamber, press it lightly and pour over the hot water. Cover and leave 15 minutes for the decoction to drip through.", "Boil the milk with the jaggery.", "Pour 2 to 3 tbsp of decoction into each tumbler, then the hot milk.", "Pour it back and forth between tumbler and bowl from a height until it froths."],
    tip: "The first, strongest drips are the best. Keep any extra decoction in the fridge for tomorrow.",
  },
  {
    id: "spanish-latte", title: "Spanish Latte", minutes: 5, makes: "1 glass",
    kit: ["Glass", "Spoon"],
    ingredients: ["60 ml espresso or strong coffee", "1½ tbsp condensed milk", "150 ml milk, hot or cold"],
    steps: ["Spoon the condensed milk into the bottom of the glass.", "Pour in the milk (hot and frothed, or cold over ice).", "Pour the coffee slowly over the back of a spoon so it sits in a layer. Stir before drinking."],
    tip: "Iced, it's even better. Use a little less condensed milk if you like it less sweet.",
  },
  {
    id: "iced-brown-sugar", title: "Iced Brown Sugar Shaken Espresso", minutes: 5, makes: "1 glass",
    kit: ["Jar with a lid or a cocktail shaker"],
    ingredients: ["60 ml espresso or strong coffee, hot", "1 tbsp brown sugar", "A pinch of cinnamon", "Lots of ice", "80 ml oat milk"],
    steps: ["Stir the sugar and cinnamon into the hot coffee until dissolved.", "Fill the jar with ice, pour in the coffee, close it and shake hard for 15 seconds.", "Pour everything into a glass and top with the oat milk."],
    tip: "Shaking with ice is what makes it light and foamy, so don't skip it.",
  },
  {
    id: "chai", title: "Rose Masala Chai", minutes: 10, makes: "2 cups",
    kit: ["Saucepan", "Tea strainer", "Pestle and mortar (or a rolling pin)"],
    ingredients: ["250 ml water", "250 ml milk", "2 tsp strong black tea (Assam)", "3 green cardamom pods, 2 cloves, a small piece of cinnamon", "1 cm fresh ginger", "2 tsp sugar", "1 tsp dried rose petals"],
    steps: ["Crush the spices and ginger roughly.", "Boil them in the water for 3 minutes.", "Add the tea and rose petals and boil 1 minute more.", "Add the milk and sugar and bring to the boil twice, lowering the heat each time it rises.", "Strain into cups."],
    tip: "Letting it rise twice is the secret to a rich, creamy chai.",
  },
  {
    id: "honey-matcha", title: "Honey Matcha Latte", minutes: 5, makes: "1 mug",
    kit: ["Small bowl", "Whisk (a bamboo one, or a small balloon whisk)", "Fine sieve"],
    ingredients: ["1 tsp matcha powder", "30 ml hot water (about 80°C, not boiling)", "200 ml milk", "1 to 2 tsp honey"],
    steps: ["Sieve the matcha into the bowl so there are no lumps.", "Add the water and whisk in a quick 'M' shape until frothy.", "Warm the milk with the honey and froth it.", "Pour the matcha into a mug and top with the milk."],
    tip: "Boiling water makes matcha bitter. Let the kettle sit for 2 minutes first.",
  },
  {
    id: "turmeric-latte", title: "Turmeric Honey Latte", minutes: 8, makes: "1 mug",
    kit: ["Small saucepan", "Whisk"],
    ingredients: ["250 ml milk (any kind)", "½ tsp ground turmeric", "A small piece of fresh ginger, grated", "A pinch of black pepper", "A pinch of cinnamon", "1 to 2 tsp honey"],
    steps: ["Whisk everything except the honey into the milk in the pan.", "Warm gently for 5 minutes, whisking, without boiling.", "Take it off the heat, stir in the honey and strain into a mug."],
    tip: "The black pepper helps your body take in the turmeric, so keep it in.",
  },
  {
    id: "cold-coffee", title: "Indian Cold Coffee", minutes: 5, makes: "2 glasses",
    kit: ["Blender (or a jar to shake)"],
    ingredients: ["2 tsp instant coffee", "2 tbsp hot water", "2 tbsp sugar", "400 ml cold full-cream milk", "8 ice cubes", "Chocolate syrup, optional"],
    steps: ["Stir the coffee and sugar into the hot water until dissolved.", "Blend with the milk and ice for 30 seconds until really frothy.", "Swirl chocolate syrup around the glasses if you like, then pour."],
    tip: "A scoop of vanilla ice cream in the blender turns it into a café-style frappé.",
  },
  {
    id: "kokum-soda", title: "Kokum Soda", minutes: 3, makes: "1 glass",
    kit: ["Tall glass", "Long spoon"],
    ingredients: ["3 tbsp kokum syrup (agal)", "½ lime", "A pinch of roasted cumin powder", "A pinch of black salt", "Ice", "Chilled soda"],
    steps: ["Put the kokum syrup, lime juice, cumin and black salt in the glass and stir.", "Add ice and top up with soda.", "Stir gently and drink straight away."],
    tip: "No kokum syrup? Soak 6 dried kokum in hot water for an hour, mash, strain and sweeten.",
  },
  {
    id: "hot-chocolate", title: "Hot Chocolate & Marshmallows", minutes: 8, makes: "2 mugs",
    kit: ["Saucepan", "Whisk"],
    ingredients: ["400 ml milk", "80 g dark chocolate (70%), chopped", "1 tbsp cocoa powder", "1 tbsp sugar", "A pinch of salt", "Whipped cream and marshmallows"],
    steps: ["Warm the milk until steaming.", "Whisk in the cocoa, sugar and salt.", "Take it off the heat and whisk in the chocolate until smooth and thick.", "Pour into mugs and top with cream and marshmallows. Toast the marshmallows with a lighter if you're brave."],
    tip: "Taking it off the heat before adding the chocolate keeps it silky, not grainy.",
  },
];

export const findHomeRecipe = (id: string) => HOME_RECIPES.find((r) => r.id === id);
