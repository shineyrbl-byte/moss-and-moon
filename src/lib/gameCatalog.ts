// What sort of game each one is, for the finder on the games page. Pure, so the page and tests share it.
export type Kind = "word" | "logic" | "cards" | "board" | "arcade" | "together";
export const KIND_LABEL: Record<Kind, string> = { word: "Word", logic: "Logic", cards: "Cards & dice", board: "Board games", arcade: "Arcade", together: "Together" };
export type Entry = { id: string; href: string; title: string; emoji: string; blurb: string; kind: Kind; quick: boolean };

/** The daily games, by id (their titles and links come from the server) */
export const DAILY_KIND: Record<string, { kind: Kind; quick: boolean }> = {
  word: { kind: "word", quick: true }, connections: { kind: "word", quick: true }, dish: { kind: "word", quick: true }, trivia: { kind: "word", quick: true },
  wordsearch: { kind: "word", quick: true }, sudoku: { kind: "logic", quick: true }, memory: { kind: "logic", quick: true }, slide: { kind: "logic", quick: true },
  crossword: { kind: "word", quick: false }, nonogram: { kind: "logic", quick: false }, crack: { kind: "logic", quick: true }, sweeper: { kind: "logic", quick: true },
  ladder: { kind: "word", quick: true }, jigsaw: { kind: "logic", quick: false }, hive: { kind: "word", quick: false }, paths: { kind: "logic", quick: true },
  tiles: { kind: "logic", quick: false }, spot: { kind: "logic", quick: true }, cipher: { kind: "word", quick: false }, flood: { kind: "logic", quick: true },
  lamps: { kind: "logic", quick: true }, jumble: { kind: "word", quick: true }, milk: { kind: "logic", quick: false }, lights: { kind: "logic", quick: false },
  table: { kind: "logic", quick: true }, parasols: { kind: "logic", quick: false }, tipjar: { kind: "logic", quick: false }, towers: { kind: "logic", quick: false },
  cups: { kind: "logic", quick: false }, corners: { kind: "word", quick: false }, sums: { kind: "logic", quick: false }, freecell: { kind: "cards", quick: false },
  boggle: { kind: "word", quick: true }, bill: { kind: "logic", quick: true },
  taller: { kind: "logic", quick: true }, traytiles: { kind: "logic", quick: true }, seats: { kind: "logic", quick: true }, four: { kind: "word", quick: true }, threads: { kind: "word", quick: false }, garden: { kind: "logic", quick: false }, rope: { kind: "logic", quick: false }, necklace: { kind: "logic", quick: false },
  trail: { kind: "logic", quick: false }, pipes: { kind: "logic", quick: true }, cutters: { kind: "logic", quick: false }, cryptic: { kind: "word", quick: true }, stars: { kind: "logic", quick: false },
  wheel: { kind: "word", quick: true }, codeword: { kind: "word", quick: false }, zip: { kind: "logic", quick: true }, bikes: { kind: "logic", quick: false }, push: { kind: "logic", quick: false }, price: { kind: "logic", quick: true },
};

/** Games you can play any time */
export const ANY_TIME: Entry[] = [
  { id: "weeklycross", href: "/weekly-crossword", title: "Weekly crossword", emoji: "🗞️", blurb: "a bigger grid that lasts all week", kind: "word", quick: false },
  { id: "quiz", href: "/quiz", title: "Quiz night", emoji: "🎤", blurb: "when the team hosts one, live on the TV", kind: "together", quick: false },
  { id: "chess", href: "/cafe-chess", title: "Café chess", emoji: "♟️", blurb: "chess against the computer", kind: "board", quick: false },
  { id: "backgammon", href: "/terrace-backgammon", title: "Terrace backgammon", emoji: "🎲", blurb: "backgammon against the computer", kind: "board", quick: false },
  { id: "snake", href: "/bean-snake", title: "Bean snake", emoji: "🐍", blurb: "eat the beans, don't bite your tail", kind: "arcade", quick: true },
  { id: "typing", href: "/call-the-order", title: "Call the order", emoji: "⌨️", blurb: "type the orders before they run out", kind: "arcade", quick: true },
  { id: "patience", href: "/cafe-patience", title: "Café patience", emoji: "🃏", blurb: "solitaire with café suits", kind: "cards", quick: false },
  { id: "stacker", href: "/cake-stacker", title: "Cake stacker", emoji: "🎂", blurb: "how tall can you build it?", kind: "arcade", quick: true },
  { id: "reversi", href: "/reversi", title: "Bean reversi", emoji: "⚫", blurb: "coffee vs milk, against the computer", kind: "board", quick: false },
  { id: "saucers", href: "/sink-the-saucers", title: "Sink the saucers", emoji: "🛸", blurb: "battleship with tableware", kind: "board", quick: false },
  { id: "mancala", href: "/bean-counting", title: "Bean counting", emoji: "🫘", blurb: "mancala against the computer", kind: "board", quick: true },
  { id: "draughts", href: "/draughts", title: "Café draughts", emoji: "⚪", blurb: "checkers against the computer", kind: "board", quick: false },
  { id: "dots", href: "/sugar-cubes", title: "Sugar cubes", emoji: "🧊", blurb: "dots and boxes against the computer", kind: "board", quick: true },
  { id: "dice", href: "/cafe-dice", title: "Café dice", emoji: "🎲", blurb: "five dice, thirteen turns, a weekly board", kind: "cards", quick: false },
  { id: "gomoku", href: "/five-in-a-row", title: "Five in a row", emoji: "⭕", blurb: "gomoku against the computer", kind: "board", quick: true },
  { id: "echo", href: "/baristas-echo", title: "Barista's echo", emoji: "🔔", blurb: "repeat the café's sounds, a weekly board", kind: "arcade", quick: true },
  { id: "breaker", href: "/bean-breaker", title: "Bean breaker", emoji: "🧱", blurb: "knock out the sugar cube wall, a weekly board", kind: "arcade", quick: true },
  { id: "pastry", href: "/pastry-drop", title: "Pastry drop", emoji: "🥐", blurb: "fill the rows as the pastries fall, a weekly board", kind: "arcade", quick: true },
  { id: "mill", href: "/saucer-mill", title: "Saucer mill", emoji: "⚪", blurb: "nine men's morris against the computer", kind: "board", quick: false },
  { id: "hearts", href: "/cafe-hearts", title: "Café hearts", emoji: "♥️", blurb: "the card game, against three computer players", kind: "cards", quick: false },
  { id: "dash", href: "/delivery-dash", title: "Delivery dash", emoji: "🚲", blurb: "jump the puddles, duck the awnings, a weekly board", kind: "arcade", quick: true },
  { id: "spider", href: "/cafe-spider", title: "Café spider", emoji: "🕸", blurb: "spider solitaire with two decks", kind: "cards", quick: false },
  { id: "pyramid", href: "/cafe-pyramid", title: "Café pyramid", emoji: "🔺", blurb: "pairs that make 13", kind: "cards", quick: true },
  { id: "eights", href: "/crazy-eights", title: "Crazy eights", emoji: "🎴", blurb: "match the suit or number, against the computer", kind: "cards", quick: true },
  { id: "rummy", href: "/cafe-rummy", title: "Café rummy", emoji: "🀄", blurb: "sets and runs, against the computer", kind: "cards", quick: false },
  { id: "ludo", href: "/cafe-ludo", title: "Café ludo", emoji: "🎲", blurb: "race four counters home, against three computers", kind: "board", quick: false },
  { id: "spoons", href: "/spoons-and-piping-bags", title: "Spoons & piping bags", emoji: "🥄", blurb: "snakes and ladders, café style", kind: "board", quick: true },
  { id: "go", href: "/cafe-go", title: "Café go", emoji: "⚫", blurb: "9×9 go against the computer", kind: "board", quick: false },
  { id: "starcheckers", href: "/star-checkers", title: "Star checkers", emoji: "✨", blurb: "Chinese checkers for two", kind: "board", quick: false },
  { id: "muncher", href: "/bean-muncher", title: "Bean muncher", emoji: "🟡", blurb: "munch the beans, dodge the cats, a weekly board", kind: "arcade", quick: true },
  { id: "puff", href: "/steam-puff", title: "Steam puff", emoji: "☁️", blurb: "float the steam through the cups, a weekly board", kind: "arcade", quick: true },
  { id: "pigeons", href: "/pigeon-patrol", title: "Pigeon patrol", emoji: "🐦", blurb: "shoo the flock off the terrace, a weekly board", kind: "arcade", quick: true },
  { id: "beat", href: "/latte-beat", title: "Latte beat", emoji: "🥁", blurb: "tap along with the café rhythm, a weekly board", kind: "arcade", quick: true },
  { id: "dominoes", href: "/cafe-dominoes", title: "Café dominoes", emoji: "🁫", blurb: "the draw game, against the computer", kind: "board", quick: false },
  { id: "letters", href: "/cafe-letters", title: "Café letters", emoji: "🔤", blurb: "a crossword tile game against the computer", kind: "board", quick: false },
  { id: "poker", href: "/cafe-poker", title: "Café poker", emoji: "🃏", blurb: "Texas hold'em for chips, never money", kind: "cards", quick: false },
  { id: "pinball", href: "/pinball-parlour", title: "Pinball parlour", emoji: "🪩", blurb: "flippers, bumpers and C-A-F-É, a weekly board", kind: "arcade", quick: true },
  { id: "road", href: "/market-road", title: "Cross the market road", emoji: "🛵", blurb: "hop across the traffic to the café, a weekly board", kind: "arcade", quick: true },
  { id: "cupcakes", href: "/pop-the-cupcakes", title: "Pop the cupcakes", emoji: "🧁", blurb: "thirty seconds of tapping, a weekly board", kind: "arcade", quick: true },
  { id: "slice", href: "/slice-the-cake", title: "Slice the cake", emoji: "🍰", blurb: "swipe the treats, dodge the chillies, a weekly board", kind: "arcade", quick: true },
  { id: "swap", href: "/sugar-swap", title: "Sugar swap", emoji: "🍬", blurb: "match three sweets in a row, a weekly board", kind: "arcade", quick: true },
  { id: "bubble", href: "/bubble-pop", title: "Bubble pop", emoji: "🫧", blurb: "aim, fire and pop the syrup bubbles, a weekly board", kind: "arcade", quick: true },
  { id: "golf", href: "/mini-golf", title: "Mini golf", emoji: "⛳", blurb: "nine little holes round the café", kind: "arcade", quick: false },
  { id: "hockey", href: "/air-hockey", title: "Air hockey", emoji: "🏒", blurb: "two players on one screen, or the computer", kind: "arcade", quick: true },
  { id: "pool", href: "/cafe-pool", title: "Café pool", emoji: "🎱", blurb: "eight-ball against the computer", kind: "board", quick: false },
  { id: "blackjack", href: "/cafe-blackjack", title: "Café blackjack", emoji: "🂡", blurb: "21 for chips, never money", kind: "cards", quick: true },
  { id: "battleship", href: "/battleship", title: "Battleship", emoji: "⚓", blurb: "sink the computer's fleet", kind: "board", quick: false },
  { id: "hangman", href: "/cafe-hangman", title: "Café hangman", emoji: "🔤", blurb: "guess the café word before the cup's empty", kind: "together", quick: true },
  { id: "tray", href: "/tray-pusher", title: "Tray pusher", emoji: "☕", blurb: "push the cups onto the saucers, 20 levels", kind: "logic", quick: true },
  { id: "jam", href: "/delivery-jam", title: "Delivery jam", emoji: "🚐", blurb: "get the cake van out of the yard, 20 levels", kind: "logic", quick: true },
  { id: "c4", href: "/connect-four", title: "Guests vs the barista", emoji: "🔴", blurb: "vote on the café's Connect Four", kind: "together", quick: true },
  { id: "higher", href: "/higher-or-lower", title: "Higher or lower", emoji: "💸", blurb: "which costs more?", kind: "arcade", quick: true },
  { id: "merge", href: "/brew-merge", title: "Brew merge", emoji: "🌙", blurb: "beans all the way to the moon brew", kind: "arcade", quick: false },
  { id: "rush", href: "/play", title: "Barista rush", emoji: "☕", blurb: "make the orders, fast", kind: "arcade", quick: true },
  { id: "bingo", href: "/bingo", title: "Coffee bingo", emoji: "🎯", blurb: "a card a month", kind: "together", quick: true },
  { id: "story", href: "/story-chain", title: "Story chain", emoji: "📜", blurb: "add the next line", kind: "together", quick: true },
  { id: "scoreboard", href: "/scoreboard", title: "Board game scoreboard", emoji: "🏆", blurb: "for the games on our shelf", kind: "together", quick: true },
];

export type Filter = { q: string; kind: Kind | "all" | "fav"; quick: boolean; favs: string[] };
/** Does a game pass the finder's filters? */
export function matches(e: { id: string; title: string; blurb: string; kind: Kind; quick: boolean }, f: Filter) {
  const q = f.q.trim().toLowerCase();
  if (q && !`${e.title} ${e.blurb} ${KIND_LABEL[e.kind]}`.toLowerCase().includes(q)) return false;
  if (f.kind === "fav" && !f.favs.includes(e.id)) return false;
  if (f.kind !== "all" && f.kind !== "fav" && e.kind !== f.kind) return false;
  if (f.quick && !e.quick) return false;
  return true;
}
export const FAVS_KEY = "mm-fav-games";
export const toggleFav = (favs: string[], id: string) => (favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id]);
