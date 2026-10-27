// What's new on the site, newest first. Written by hand when something guests can use is added. Pure.
export type News = { date: string; title: string; items: { text: string; href?: string }[] };
export const NEWS: News[] = [
  { date: "2026-10-27", title: "At the café", items: [
    { text: "Vote for the songs you'd like next: the most votes play first", href: "/songs" },
    { text: "Menu picks for the time of day, alongside the weather picks", href: "/#menu" },
    { text: "Send your own latte art: once the team has had a look it joins the weekly vote", href: "/latte-art" },
    { text: "Board-game night bookings, when the café runs one", href: "/game-night" },
    { text: "What's on around Goa, on the Around the corner page", href: "/nearby" },
  ] },
  { date: "2026-10-27", title: "Smoother games", items: [
    { text: "Board looks: pick Café, High contrast, Garden or Night for every puzzle grid", href: "/game-settings" },
    { text: "Pages load faster: the translations and how-to-play cards only load when they're needed" },
    { text: "Clearer for screen readers, and better colour contrast on cards, trophies and boards" },
    { text: "The mini crossword and word ladder now go through every puzzle before one comes back" },
  ] },
  { date: "2026-10-27", title: "Friends", items: [
    { text: "Game profiles: a picture, a favourite game and three trophies to show off", href: "/friends" },
    { text: "See what your friends have been playing, and your record against each of them", href: "/friends" },
    { text: "Slow games: Connect four or reversi with a friend by link, a move whenever you like", href: "/slow-games" },
  ] },
  { date: "2026-10-27", title: "Seasons and events", items: [
    { text: "Season packs for Diwali, Christmas and the monsoon", href: "/season-pack" },
    { text: "The advent picture: a square opens for each December day you play", href: "/advent-puzzles" },
    { text: "A puzzle hunt every weekend: five keys hidden around the site", href: "/puzzle-hunt" },
    { text: "Café Games Day on the second Saturday of November, with two trophies", href: "/games" },
  ] },
  { date: "2026-10-27", title: "More to play", items: [
    { text: "New daily puzzles: sugar cages, word chain, colour pixels, word wheel, codeword, zip path, delivery bikes, bean push and price order", href: "/games" },
    { text: "New any-time games: golf and TriPeaks solitaire, pastry defence, market run, sugar swap, bubble pop, mini golf, air hockey, pool, blackjack, battleship and hangman", href: "/games" },
    { text: "Where in Goa? Guess the place from a photo", href: "/where-in-goa" },
    { text: "Play together: ludo for four, poker, dominoes and letters, daily duels and café clubs", href: "/play-together" },
    { text: "Race your ghost, zen mode, time charts, offline puzzles and Learn to play", href: "/learn" },
  ] },
  { date: "2026-10-26", title: "Games corner grows", items: [
    { text: "The weekly crossword and the puzzle of the week", href: "/weekly-crossword" },
    { text: "Challenge links, practice puzzles, the hall of fame and daily reminders", href: "/practice" },
    { text: "Friends, account sync and live rooms", href: "/friends" },
    { text: "Chess, backgammon, FreeCell, hearts and lots more", href: "/games" },
  ] },
  { date: "2026-10-25", title: "The games corner opens", items: [
    { text: "Daily puzzles, trophies and Today's five", href: "/games" },
    { text: "Quiz night, the photo booth and split the bill", href: "/quiz" },
  ] },
  { date: "2026-10-24", title: "Around the café", items: [
    { text: "Sunset tracker, moon calendar, wish tree, book club and Konkani word of the day", href: "/sunset" },
    { text: "Lost & found, notes for a stranger and the Goa fruit calendar", href: "/lost-found" },
  ] },
  { date: "2026-10-23", title: "New on the menu and more", items: [
    { text: "Twelve new dishes, from dalgona to Goan snacks", href: "/#menu" },
    { text: "The drink lab, the origins passport, pay it forward and song requests", href: "/lab" },
  ] },
];
export const SEEN_KEY = "mm-news-seen";
