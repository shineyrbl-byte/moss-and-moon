// Game trophies: worked out from what you've played (from the server) and wins kept in this browser. Pure, so the page and tests share it.
import { KINDS } from "./todaysFive.ts";
import { EVENTS, progress } from "./seasonalGames.ts";

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
export const earned = (c: TrophyCtx) => TROPHIES.filter((t) => t.test(c)).map((t) => t.id);
