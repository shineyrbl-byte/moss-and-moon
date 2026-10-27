// Game trophies: worked out from what you've played (from the server) and wins kept in this browser. Pure, so the page and tests share it.
import { KINDS } from "./todaysFive.ts";
import { EVENTS, progress } from "./seasonalGames.ts";
import { bestGamesDay } from "./gamesDay.ts";

// Kept here as numbers (rather than importing the level lists) so the trophy shelf stays small
export const TRAY_LEVELS = 20, JAM_LEVELS = 20;

type Rec = { won?: number };
export type TrophyCtx = {
  played: Record<string, string[]>; // daily game -> days played
  five: string[]; // days you finished Today's five
  arcade: Record<string, number | null>; // best ever score per arcade game
  local: {
    reversi?: Record<string, Rec>; saucers?: Record<string, Rec>; mancala?: Record<string, Rec>; draughts?: Record<string, Rec>; dots?: Record<string, Rec>; gomoku?: Record<string, Rec>; morris?: Record<string, Rec>; hearts?: Record<string, Rec>; chess?: Record<string, Rec>; backgammon?: Record<string, Rec>;
    archive?: number; // past days finished from the archive
    tray?: number; jam?: number; // puzzle pack levels done
    patience?: { won?: number; streak?: number; bestStreak?: number };
    flags?: string[]; // one-off moments, like beating par in Flood
  };
};
export type Trophy = { id: string; emoji: string; name: string; how: string; test: (c: TrophyCtx) => boolean; group: string };

/** Longest run of days in a row */
export function longestRun(days: string[]) {
  const ds = [...new Set(days)].sort().map((d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400_000);
  let best = 0, run = 0;
  ds.forEach((d, i) => { run = i && d === ds[i - 1] + 1 ? run + 1 : 1; best = Math.max(best, run); });
  return best;
}
const tried = (c: TrophyCtx, ids: readonly string[]) => ids.filter((id) => c.played[id]?.length).length;
const allDays = (c: TrophyCtx) => [...new Set(Object.values(c.played).flat())];
const bestStreak = (c: TrophyCtx) => Math.max(0, ...Object.values(c.played).map(longestRun));
const won = (r: Record<string, Rec> | undefined, level?: string) => (level ? (r?.[level]?.won ?? 0) : Object.values(r ?? {}).reduce((s, x) => s + (x.won ?? 0), 0)) > 0;
const flag = (c: TrophyCtx, f: string) => !!c.local.flags?.includes(f);
const arcade = (c: TrophyCtx, g: string, n: number) => (c.arcade[g] ?? 0) >= n;

export const TROPHIES: Trophy[] = [
  { group: "Daily games", id: "first", emoji: "☕", name: "First sip", how: "Play any daily game", test: (c) => allDays(c).length > 0 },
  { group: "Daily games", id: "words", emoji: "📚", name: "Wordsmith", how: "Try five different word games", test: (c) => tried(c, KINDS.word) >= 5 },
  { group: "Daily games", id: "logic", emoji: "🧠", name: "Puzzler", how: "Try five different logic puzzles", test: (c) => tried(c, KINDS.logic) >= 5 },
  { group: "Daily games", id: "everything", emoji: "🗺", name: "Tried them all", how: "Play every daily game at least once", test: (c) => Object.keys(c.played).length > 0 && Object.values(c.played).every((d) => d.length > 0) },
  { group: "Daily games", id: "fullhouse", emoji: "🏠", name: "Full house", how: "Play every daily game in one day", test: (c) => allDays(c).some((d) => Object.values(c.played).every((x) => x.includes(d))) },
  { group: "Daily games", id: "ten", emoji: "🔟", name: "Regular face", how: "Play on 10 different days", test: (c) => allDays(c).length >= 10 },
  { group: "Daily games", id: "fifty", emoji: "🪑", name: "Your usual seat", how: "Play on 50 different days", test: (c) => allDays(c).length >= 50 },
  { group: "Streaks", id: "streak3", emoji: "🔥", name: "Warming up", how: "Play the same daily game 3 days in a row", test: (c) => bestStreak(c) >= 3 },
  { group: "Streaks", id: "streak7", emoji: "📅", name: "A week of mornings", how: "Play the same daily game 7 days in a row", test: (c) => bestStreak(c) >= 7 },
  { group: "Streaks", id: "streak30", emoji: "🌙", name: "Part of the furniture", how: "Play the same daily game 30 days in a row", test: (c) => bestStreak(c) >= 30 },
  { group: "Streaks", id: "five", emoji: "🎲", name: "High five", how: "Finish Today's five", test: (c) => c.five.length > 0 },
  { group: "Streaks", id: "five7", emoji: "🖐", name: "Five a day", how: "Finish Today's five 7 days in a row", test: (c) => longestRun(c.five) >= 7 },
  { group: "Clever moments", id: "duels", emoji: "⚔️", name: "Duellist", how: "Win five daily duels", test: (c) => flag(c, "duel-five") },
  { group: "Clever moments", id: "clubTop", emoji: "👥", name: "Club captain", how: "Be in the top café club of the week", test: (c) => flag(c, "club-top") },
  { group: "Clever moments", id: "learner", emoji: "🎓", name: "Quick study", how: "Finish all four Learn to play lessons", test: (c) => flag(c, "learn-all") },
  { group: "Clever moments", id: "setter", emoji: "✏️", name: "Puzzle setter", how: "Make a mini sudoku with one answer and share it", test: (c) => flag(c, "maker-shared") },
  { group: "Clever moments", id: "champ", emoji: "🏆", name: "Café champion", how: "Win a mini tournament", test: (c) => flag(c, "tournament-won") },
  { group: "Clever moments", id: "rival", emoji: "🤝", name: "Friendly rival", how: "Beat a friend's challenge link on a daily puzzle", test: (c) => flag(c, "challenge-won") },
  { group: "Clever moments", id: "underpar", emoji: "🎨", name: "Below par", how: "Beat par in Flood the cup", test: (c) => flag(c, "flood-under-par") },
  { group: "Clever moments", id: "lamps", emoji: "💡", name: "Bright spark", how: "Turn off the lamps in the fewest taps", test: (c) => flag(c, "lamps-fewest") },
  { group: "Clever moments", id: "cipher", emoji: "🔏", name: "Codebreaker", how: "Crack a cryptogram with no hints", test: (c) => flag(c, "cipher-no-hints") },
  { group: "Clever moments", id: "jumble", emoji: "🔀", name: "Unscrambled", how: "Finish a bean jumble with no skips", test: (c) => flag(c, "jumble-no-skips") },
  { group: "Clever moments", id: "milk", emoji: "🥛", name: "Perfect blend", how: "Solve Milk & coffee with no hints", test: (c) => flag(c, "milk-no-hints") },
  { group: "Clever moments", id: "fiveKind", emoji: "🎲", name: "Five of a kind", how: "Roll five of a kind in Café dice", test: (c) => flag(c, "dice-five") },
  { group: "Clever moments", id: "table", emoji: "🪑", name: "Seating plan", how: "Solve Table for one with no hints", test: (c) => flag(c, "table-no-hints") },
  { group: "Clever moments", id: "tipjar", emoji: "🪙", name: "Exact change", how: "Solve Tip jar with no hints", test: (c) => flag(c, "tipjar-no-hints") },
  { group: "Clever moments", id: "parasols", emoji: "⛱️", name: "Made in the shade", how: "Solve Parasols with no hints", test: (c) => flag(c, "parasols-no-hints") },
  { group: "Clever moments", id: "towers", emoji: "🎂", name: "Tiered perfectly", how: "Solve Cake towers with no hints", test: (c) => flag(c, "towers-no-hints") },
  { group: "Clever moments", id: "cups", emoji: "🥤", name: "Tidy shelf", how: "Solve Spare cups with no hints", test: (c) => flag(c, "cups-no-hints") },
  { group: "Clever moments", id: "corners", emoji: "🔤", name: "Barista's match", how: "Finish Café corners in as few words as the barista", test: (c) => flag(c, "corners-par") },
  { group: "Clever moments", id: "sums", emoji: "➕", name: "Sum total", how: "Solve Bean sums with no hints", test: (c) => flag(c, "sums-no-hints") },
  { group: "Clever moments", id: "freecell", emoji: "🃏", name: "Free and easy", how: "Win a game of Café FreeCell", test: (c) => flag(c, "freecell-win") },
  { group: "Clever moments", id: "boggle", emoji: "🔠", name: "Word hoard", how: "Score 30 points in Bean boggle", test: (c) => flag(c, "boggle-30") },
  { group: "Clever moments", id: "bill", emoji: "🧾", name: "Spot on", how: "Hit the Bill total exactly", test: (c) => flag(c, "bill-exact") },
  { group: "Against the computer", id: "spiderWin", emoji: "🕸", name: "Web master", how: "Win a game of Café spider", test: (c) => flag(c, "spider-win") },
  { group: "Against the computer", id: "spiderTwo", emoji: "🕷", name: "Two-suit spinner", how: "Win Café spider with two suits", test: (c) => flag(c, "spider-two") },
  { group: "Against the computer", id: "pyramidWin", emoji: "🔺", name: "Pyramid scheme", how: "Clear the Café pyramid", test: (c) => flag(c, "pyramid-win") },
  { group: "Against the computer", id: "eightsWin", emoji: "🎴", name: "Crazy about eights", how: "Win a game of Crazy eights", test: (c) => flag(c, "eights-win") },
  { group: "Against the computer", id: "rummyWin", emoji: "🀄", name: "Rummy business", how: "Win a game of Café rummy", test: (c) => flag(c, "rummy-win") },
  { group: "Against the computer", id: "ludoWin", emoji: "🏁", name: "Home run", how: "Win a game of Café ludo", test: (c) => flag(c, "ludo-win") },
  { group: "Against the computer", id: "spoonsWin", emoji: "🥄", name: "Top spoon", how: "Reach 100 first in Spoons & piping bags", test: (c) => flag(c, "spoons-win") },
  { group: "Against the computer", id: "goWin", emoji: "⚫", name: "Stone cold", how: "Beat the computer at Café go", test: (c) => flag(c, "go-win") },
  { group: "Against the computer", id: "goHard", emoji: "🪨", name: "Go master", how: "Beat the computer at Café go on hard", test: (c) => flag(c, "go-hard") },
  { group: "Against the computer", id: "starWin", emoji: "✨", name: "Star crossed", how: "Win a game of Star checkers", test: (c) => flag(c, "star-win") },
  { group: "Arcade", id: "puff25", emoji: "☁️", name: "Cloud nine", how: "Float through 25 gaps in Steam puff", test: (c) => flag(c, "puff-25") },
  { group: "Arcade", id: "pigeons3", emoji: "🐦", name: "Flock off", how: "Reach wave 3 in Pigeon patrol", test: (c) => flag(c, "pigeons-wave3") },
  { group: "Arcade", id: "muncher3", emoji: "🟡", name: "Full of beans", how: "Clear 3 rounds of Bean muncher", test: (c) => flag(c, "muncher-round3") },
  { group: "Arcade", id: "beatFull", emoji: "🥁", name: "Perfect pour", how: "Hit every note of a Latte beat song", test: (c) => flag(c, "beat-full-combo") },
  { group: "Clever moments", id: "tallerClever", emoji: "📏", name: "Perfect order", how: "Solve Taller order with no hints", test: (c) => flag(c, "taller-no-hints") },
  { group: "Clever moments", id: "traytilesClever", emoji: "🍱", name: "Neat and tidy", how: "Solve Tray tiles with no hints", test: (c) => flag(c, "traytiles-no-hints") },
  { group: "Clever moments", id: "seatsClever", emoji: "💡", name: "Lights on", how: "Solve Window seats with no hints", test: (c) => flag(c, "seats-no-hints") },
  { group: "Clever moments", id: "fourClever", emoji: "🍀", name: "Four leaf", how: "Get all four words in Four at once in 6 tries or fewer", test: (c) => flag(c, "four-six") },
  { group: "Clever moments", id: "threadsClever", emoji: "🧵", name: "Hanging by a thread", how: "Find every Menu thread without a hint", test: (c) => flag(c, "threads-no-hints") },
  { group: "Clever moments", id: "gardenClever", emoji: "🌷", name: "Green fingers", how: "Solve Garden plots with no hints", test: (c) => flag(c, "garden-no-hints") },
  { group: "Clever moments", id: "ropeClever", emoji: "🪢", name: "Learning the ropes", how: "Solve Queue rope with no hints", test: (c) => flag(c, "rope-no-hints") },
  { group: "Clever moments", id: "necklaceClever", emoji: "📿", name: "String of pearls", how: "Solve Bead necklace with no hints", test: (c) => flag(c, "necklace-no-hints") },
  { group: "Clever moments", id: "trailClever", emoji: "☕", name: "Trailblazer", how: "Solve Coffee trail with no hints", test: (c) => flag(c, "trail-no-hints") },
  { group: "Clever moments", id: "pipesClever", emoji: "♨️", name: "Full steam ahead", how: "Solve Steam pipes with no hints", test: (c) => flag(c, "pipes-no-hints") },
  { group: "Clever moments", id: "cuttersClever", emoji: "🍪", name: "Clean cut", how: "Solve Cookie cutters with no hints", test: (c) => flag(c, "cutters-no-hints") },
  { group: "Clever moments", id: "crypticClever", emoji: "✏️", name: "Cryptic crossworder", how: "Crack the cryptic clue first go, with no hints", test: (c) => flag(c, "cryptic-first-go") },
  { group: "Clever moments", id: "starsClever", emoji: "⭐", name: "Star baker", how: "Solve Sugar stars with no hints", test: (c) => flag(c, "stars-no-hints") },
  { group: "Clever moments", id: "wheelClever", emoji: "🎡", name: "Full circle", how: "Find every everyday word in a Word wheel", test: (c) => flag(c, "wheel-genius") },
  { group: "Clever moments", id: "codewordClever", emoji: "🔢", name: "Code breaker", how: "Crack a Codeword with no hints", test: (c) => flag(c, "codeword-no-hints") },
  { group: "Clever moments", id: "zipClever", emoji: "〰️", name: "Zipped up", how: "Solve Zip path with no hints", test: (c) => flag(c, "zip-no-hints") },
  { group: "Clever moments", id: "bikesClever", emoji: "🚲", name: "Fleet manager", how: "Solve Delivery bikes with no hints", test: (c) => flag(c, "bikes-no-hints") },
  { group: "Clever moments", id: "pushClever", emoji: "🫘", name: "Neat storeroom", how: "Finish Bean push within twice the moves it was made in", test: (c) => flag(c, "push-tidy") },
  { group: "Clever moments", id: "priceClever", emoji: "💸", name: "Price check", how: "Get Price order right first go", test: (c) => flag(c, "price-first-go") },
  { group: "Clever moments", id: "weeklycrossClever", emoji: "🗞️", name: "Weekend paper", how: "Finish the weekly crossword without showing a letter", test: (c) => flag(c, "weeklycross-no-hints") },
  { group: "Streaks", id: "archive", emoji: "🗂", name: "Catching up", how: "Finish 5 puzzles from the archive", test: (c) => (c.local.archive ?? 0) >= 5 },
  { group: "Arcade", id: "stack15", emoji: "🎂", name: "Tall order", how: "Stack 15 layers in Cake stacker", test: (c) => arcade(c, "stacker", 15) },
  { group: "Arcade", id: "stack40", emoji: "💒", name: "Wedding cake", how: "Stack 40 layers in Cake stacker", test: (c) => arcade(c, "stacker", 40) },
  { group: "Arcade", id: "typing", emoji: "⌨️", name: "Quick fingers", how: "Send 20 orders in Call the order", test: (c) => arcade(c, "typing", 20) },
  { group: "Arcade", id: "snake", emoji: "🐍", name: "Bean feast", how: "Eat 25 beans in Bean snake", test: (c) => arcade(c, "snake", 25) },
  { group: "Arcade", id: "higher", emoji: "💸", name: "Price is right", how: "Get 10 right in Higher or lower", test: (c) => arcade(c, "higherlower", 10) },
  { group: "Arcade", id: "dice", emoji: "🎰", name: "High roller", how: "Score 250 in Café dice", test: (c) => arcade(c, "dice", 250) },
  { group: "Arcade", id: "echo", emoji: "🔔", name: "Good ear", how: "Remember a run of 12 in Barista's echo", test: (c) => arcade(c, "echo", 12) },
  { group: "Arcade", id: "breaker", emoji: "🧱", name: "Sugar crash", how: "Score 2,000 in Bean breaker", test: (c) => arcade(c, "breaker", 2000) },
  { group: "Arcade", id: "pastry", emoji: "🥐", name: "Bake sale", how: "Score 5,000 in Pastry drop", test: (c) => arcade(c, "pastry", 5000) },
  { group: "Arcade", id: "pastryFour", emoji: "🧺", name: "Full tray", how: "Clear four rows at once in Pastry drop", test: (c) => flag(c, "pastry-four") },
  { group: "Arcade", id: "dash", emoji: "🚲", name: "Morning rounds", how: "Score 1,000 in Delivery dash", test: (c) => arcade(c, "dash", 1000) || flag(c, "dash-1000") },
  { group: "Arcade", id: "merge", emoji: "🌕", name: "Over the moon", how: "Score 5,000 in Brew merge", test: (c) => arcade(c, "merge", 5000) },
  { group: "Clever moments", id: "cagesClever", emoji: "🍬", name: "Cage keeper", how: "Solve Sugar cages with no hints", test: (c) => flag(c, "cages-no-hints") },
  { group: "Clever moments", id: "chain20", emoji: "⛓️", name: "Chain gang", how: "Make a Word chain of 20 words", test: (c) => flag(c, "chain-20") },
  { group: "Clever moments", id: "colourClever", emoji: "🎨", name: "Painter", how: "Finish Colour pixels with no hints", test: (c) => flag(c, "colour-no-hints") },
  { group: "Clever moments", id: "golfCards", emoji: "⛳", name: "Fairway", how: "Clear every column in Golf solitaire", test: (c) => flag(c, "golf-cards-clear") },
  { group: "Clever moments", id: "tripeaks", emoji: "🏔️", name: "Summit", how: "Clear all three peaks in TriPeaks", test: (c) => flag(c, "tripeaks-clear") },
  { group: "Arcade", id: "defence", emoji: "🐜", name: "Pest control", how: "Reach wave 15 in Pastry defence", test: (c) => flag(c, "defence-15") },
  { group: "Arcade", id: "run", emoji: "🏃", name: "Market dash", how: "Score 3,000 in Market run", test: (c) => arcade(c, "run", 3000) || flag(c, "run-3000") },
  { group: "Clever moments", id: "goa", emoji: "🌴", name: "Local", how: "Get five Where in Goa? photos right in a row", test: (c) => flag(c, "goa-five") },
  { group: "Arcade", id: "swap", emoji: "🍬", name: "Sweet streak", how: "Score 3,000 in Sugar swap", test: (c) => arcade(c, "swap", 3000) || flag(c, "swap-3000") },
  { group: "Clever moments", id: "swapChain", emoji: "⛓️", name: "Chain reaction", how: "Set off a chain of four in Sugar swap", test: (c) => flag(c, "swap-chain4") },
  { group: "Arcade", id: "bubble", emoji: "🫧", name: "Bubble trouble", how: "Score 2,000 in Bubble pop", test: (c) => arcade(c, "bubble", 2000) || flag(c, "bubble-2000") },
  { group: "Clever moments", id: "avalanche", emoji: "🌊", name: "Avalanche", how: "Drop six or more bubbles with one shot", test: (c) => flag(c, "bubble-avalanche") },
  { group: "Clever moments", id: "ace", emoji: "⛳", name: "Hole in one", how: "Get a hole in one at Mini golf", test: (c) => flag(c, "golf-ace") },
  { group: "Clever moments", id: "golfPar", emoji: "🏌️", name: "Under par", how: "Finish a Mini golf round at par or better", test: (c) => flag(c, "golf-par") },
  { group: "Against the computer", id: "hockey", emoji: "🏒", name: "Puck stops here", how: "Beat the computer at Air hockey", test: (c) => flag(c, "hockey-win") || flag(c, "hockey-hard") },
  { group: "Against the computer", id: "hockeyHard", emoji: "🥅", name: "Ice cold", how: "Beat the computer at Air hockey on hard", test: (c) => flag(c, "hockey-hard") },
  { group: "Against the computer", id: "pool", emoji: "🎱", name: "Behind the eight ball", how: "Win a game of Café pool", test: (c) => flag(c, "pool-win") || flag(c, "pool-hard") },
  { group: "Against the computer", id: "poolHard", emoji: "🎯", name: "Pool shark", how: "Win Café pool on hard", test: (c) => flag(c, "pool-hard") },
  { group: "Clever moments", id: "blackjack", emoji: "🂡", name: "Double or nothing", how: "Reach 2,000 chips at Café blackjack", test: (c) => flag(c, "blackjack-double") },
  { group: "Against the computer", id: "battleship", emoji: "⚓", name: "Admiral", how: "Sink the computer's fleet", test: (c) => flag(c, "battleship-win") || flag(c, "battleship-hard") },
  { group: "Against the computer", id: "battleshipHard", emoji: "🚢", name: "Fleet commander", how: "Win Battleship on hard", test: (c) => flag(c, "battleship-hard") },
  { group: "Clever moments", id: "hangman", emoji: "☕", name: "Full cup", how: "Guess five Café hangman words in a row", test: (c) => flag(c, "hangman-five") },
  { group: "Against the computer", id: "dominoes", emoji: "🁫", name: "Double six", how: "Win a dominoes match", test: (c) => flag(c, "dominoes-win") || flag(c, "dominoes-hard") },
  { group: "Against the computer", id: "dominoesHard", emoji: "🀄", name: "Bone dry", how: "Win a dominoes match on hard", test: (c) => flag(c, "dominoes-hard") },
  { group: "Against the computer", id: "letters", emoji: "🔤", name: "Tile tactician", how: "Beat the computer at Café letters", test: (c) => flag(c, "letters-win") || flag(c, "letters-hard") },
  { group: "Against the computer", id: "lettersHard", emoji: "📚", name: "Dictionary corner", how: "Beat the computer at Café letters on hard", test: (c) => flag(c, "letters-hard") },
  { group: "Clever moments", id: "letters40", emoji: "💯", name: "Big word", how: "Score 40 or more with one move in Café letters", test: (c) => flag(c, "letters-40") },
  { group: "Against the computer", id: "poker", emoji: "🃏", name: "Poker face", how: "Win a showdown against two or more players in Café poker", test: (c) => flag(c, "poker-showdown") },
  { group: "Against the computer", id: "pokerAll", emoji: "🪙", name: "Cleaned out the table", how: "Win every chip in a Café poker session", test: (c) => flag(c, "poker-cleanup") },
  { group: "Arcade", id: "pinball", emoji: "🪩", name: "Tilt-free", how: "Score 20,000 in Pinball parlour", test: (c) => arcade(c, "pinball", 20000) || flag(c, "pinball-20k") },
  { group: "Arcade", id: "road", emoji: "🛵", name: "Road sense", how: "Reach level 3 in Cross the market road", test: (c) => flag(c, "road-level3") },
  { group: "Arcade", id: "cupcakes", emoji: "🧁", name: "Clean hands", how: "Score 300 in Pop the cupcakes without touching a burnt one", test: (c) => flag(c, "cupcakes-clean") },
  { group: "Arcade", id: "slice", emoji: "🔪", name: "Cake slicer", how: "Score 500 in Slice the cake", test: (c) => arcade(c, "slice", 500) || flag(c, "slice-500") },
  { group: "Against the computer", id: "reversi", emoji: "⚫", name: "Bean counter", how: "Win a game of Bean reversi", test: (c) => won(c.local.reversi) },
  { group: "Against the computer", id: "reversiHard", emoji: "🏁", name: "Corner office", how: "Win Bean reversi on hard", test: (c) => won(c.local.reversi, "hard") },
  { group: "Against the computer", id: "saucers", emoji: "🛸", name: "Saucer spotter", how: "Win Sink the saucers", test: (c) => won(c.local.saucers) },
  { group: "Against the computer", id: "saucersHard", emoji: "🎯", name: "Sharp shooter", how: "Win Sink the saucers on hard", test: (c) => won(c.local.saucers, "hard") },
  { group: "Against the computer", id: "mancala", emoji: "🫘", name: "Full cups", how: "Win a game of Bean counting", test: (c) => won(c.local.mancala) },
  { group: "Against the computer", id: "mancalaHard", emoji: "🏺", name: "Bean master", how: "Win Bean counting on hard", test: (c) => won(c.local.mancala, "hard") },
  { group: "Against the computer", id: "draughts", emoji: "⚪", name: "Crowned", how: "Win a game of Café draughts", test: (c) => won(c.local.draughts) },
  { group: "Against the computer", id: "draughtsHard", emoji: "👑", name: "King of the table", how: "Win Café draughts on hard", test: (c) => won(c.local.draughts, "hard") },
  { group: "Against the computer", id: "dots", emoji: "🧊", name: "Sweet tooth", how: "Win a game of Sugar cubes", test: (c) => won(c.local.dots) },
  { group: "Against the computer", id: "dotsHard", emoji: "🍬", name: "Sugar rush", how: "Win Sugar cubes on hard", test: (c) => won(c.local.dots, "hard") },
  { group: "Against the computer", id: "gomoku", emoji: "⭕", name: "Lined up", how: "Win a game of Five in a row", test: (c) => won(c.local.gomoku) },
  { group: "Against the computer", id: "gomokuHard", emoji: "🧠", name: "Five ahead", how: "Win Five in a row on hard", test: (c) => won(c.local.gomoku, "hard") },
  { group: "Against the computer", id: "morris", emoji: "⚪", name: "Run of the mill", how: "Win a game of Saucer mill", test: (c) => won(c.local.morris) },
  { group: "Against the computer", id: "morrisHard", emoji: "🌾", name: "Master miller", how: "Win Saucer mill on hard", test: (c) => won(c.local.morris, "hard") },
  { group: "Against the computer", id: "hearts", emoji: "♥️", name: "Sweetheart", how: "Win a game of Café hearts", test: (c) => won(c.local.hearts) },
  { group: "Against the computer", id: "heartsHard", emoji: "👸", name: "Queen of hearts", how: "Win Café hearts on hard", test: (c) => won(c.local.hearts, "hard") },
  { group: "Against the computer", id: "chess", emoji: "♟️", name: "Checkmate", how: "Win a game of Café chess", test: (c) => won(c.local.chess) },
  { group: "Against the computer", id: "chessHard", emoji: "♛", name: "Café grandmaster", how: "Win Café chess on hard", test: (c) => won(c.local.chess, "hard") },
  { group: "Against the computer", id: "backgammon", emoji: "🎲", name: "Home and dry", how: "Win a game of Terrace backgammon", test: (c) => won(c.local.backgammon) },
  { group: "Against the computer", id: "gammon", emoji: "🎯", name: "Double trouble", how: "Win a gammon or backgammon in Terrace backgammon", test: (c) => flag(c, "backgammon-gammon") },
  { group: "Against the computer", id: "patience", emoji: "🃏", name: "Patience pays", how: "Win a game of Café patience", test: (c) => (c.local.patience?.won ?? 0) > 0 },
  { group: "Against the computer", id: "patience3", emoji: "🍀", name: "Lucky streak", how: "Win Café patience 3 times in a row", test: (c) => Math.max(c.local.patience?.streak ?? 0, c.local.patience?.bestStreak ?? 0) >= 3 },
  { group: "Puzzle packs", id: "tray5", emoji: "☕", name: "Steady hands", how: "Finish 5 Tray pusher levels", test: (c) => (c.local.tray ?? 0) >= 5 },
  { group: "Puzzle packs", id: "trayAll", emoji: "🫖", name: "Head waiter", how: "Finish every Tray pusher level", test: (c) => (c.local.tray ?? 0) >= TRAY_LEVELS },
  { group: "Puzzle packs", id: "trayFewest", emoji: "👣", name: "Not a step wasted", how: "Finish a Tray pusher level in the fewest steps", test: (c) => flag(c, "tray-fewest") },
  { group: "Puzzle packs", id: "jam5", emoji: "🚐", name: "On the road", how: "Finish 5 Delivery jam levels", test: (c) => (c.local.jam ?? 0) >= 5 },
  { group: "Puzzle packs", id: "jamAll", emoji: "🎂", name: "Special delivery", how: "Finish every Delivery jam level", test: (c) => (c.local.jam ?? 0) >= JAM_LEVELS },
  { group: "Puzzle packs", id: "jamFewest", emoji: "🗺", name: "Shortcut", how: "Finish a Delivery jam level in the fewest moves", test: (c) => flag(c, "jam-fewest") },
];
// Seasonal ones, from the festivals the café dresses up for
TROPHIES.push(...EVENTS.map((e) => ({ group: "Seasons", id: e.id, emoji: e.emoji, name: e.name, how: e.how, test: (c: TrophyCtx) => progress(e, c.played) >= e.need })));
TROPHIES.push(
  { group: "Seasons", id: "packDiwali", emoji: "🏮", name: "Lamplighter", how: "Finish all three pictures in the Diwali season pack", test: (c) => flag(c, "season-diwali") },
  { group: "Seasons", id: "packChristmas", emoji: "🎁", name: "Deck the halls", how: "Finish all three pictures in the Christmas season pack", test: (c) => flag(c, "season-christmas") },
  { group: "Seasons", id: "packMonsoon", emoji: "🌧️", name: "Rain painter", how: "Finish all three pictures in the monsoon season pack", test: (c) => flag(c, "season-monsoon") },
  { group: "Seasons", id: "advent", emoji: "🎅", name: "Every door open", how: "Open all 24 squares of the advent picture", test: (c) => flag(c, "advent-picture") },
  { group: "Seasons", id: "hunt", emoji: "🗝️", name: "Treasure hunter", how: "Find all five keys in a weekend puzzle hunt", test: (c) => flag(c, "hunt-done") },
  { group: "Seasons", id: "gamesDay5", emoji: "🎪", name: "Games Day regular", how: "Finish 5 daily puzzles on Café Games Day", test: (c) => bestGamesDay(c.played) >= 5 },
  { group: "Seasons", id: "gamesDay10", emoji: "🎡", name: "Games Day hero", how: "Finish 10 daily puzzles on Café Games Day", test: (c) => bestGamesDay(c.played) >= 10 },
);
export const earned = (c: TrophyCtx) => TROPHIES.filter((t) => t.test(c)).map((t) => t.id);
