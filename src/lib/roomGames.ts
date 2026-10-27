// Live games with hidden cards (poker, dominoes, café letters) are run by the server: devices send what they want to
// do, the server checks it's their turn and plays it with the same rules code the single-player games use, and
// each player only ever gets back their own hand. Pure (the rooms store saves the state).
import { seededRand } from "./gameOrders.ts";
import * as PK from "./poker.ts";
import * as DM from "./dominoes.ts";
import * as CL from "./cafeLetters.ts";

export const SERVER_GAMES = ["poker", "dominoes", "letters"] as const;
export type ServerGame = (typeof SERVER_GAMES)[number];
export const isServerGame = (g: unknown): g is ServerGame => SERVER_GAMES.includes(g as ServerGame);

type PokerState = { kind: "poker"; started: boolean; players: number; h: PK.Hand | null; seats: PK.Seat[]; dealer: number; handNo: number; seed: number };
type DomState = { kind: "dominoes"; r: DM.Round; match: [number, number]; scored: boolean; seed: number };
type LetState = { kind: "letters"; g: CL.Game; seed: number };
export type RoomState = (PokerState | DomState | LetState) & { seat: number; over: boolean };

/** A fresh random for this step, carried in the state so the server never needs Math.random */
const nextRand = (st: { seed: number }) => { const r = seededRand(String(st.seed)); st.seed = Math.floor(r() * 2 ** 31); return seededRand(String(st.seed)); };

export function freshState(game: ServerGame, seed: number): RoomState {
  const st = { seed };
  if (game === "poker") return { kind: "poker", started: false, players: 1, h: null, seats: PK.newTable(), dealer: 0, handNo: 0, seed: st.seed, seat: 0, over: false };
  if (game === "dominoes") return { kind: "dominoes", r: DM.deal(nextRand(st), 0), match: [0, 0], scored: false, seed: st.seed, seat: 0, over: false };
  const g = CL.newGame(nextRand(st));
  return { kind: "letters", g, seed: st.seed, seat: 0, over: false };
}
/** Someone joined: poker needs to know how many are at the table */
export function seated(s: RoomState, players: number): RoomState {
  if (s.kind !== "poker" || s.started) return s;
  return { ...s, players };
}

export type Action =
  | { type: "deal" } | { type: "next" }
  | { type: "fold" } | { type: "check" } | { type: "call" } | { type: "raise"; to: number }
  | { type: "play"; tile: [number, number]; end: "left" | "right" } | { type: "draw" }
  | { type: "word"; move: CL.Placement } | { type: "pass"; swap: string[] };

/** Apply what `seat` wants to do. Returns the new state, or why not. */
export function apply(s0: RoomState, seat: number, a: Action): { s: RoomState } | { error: string } {
  const s = structuredClone(s0) as RoomState;
  if (s.kind === "poker") {
    if (a.type === "deal" || a.type === "next") {
      if (a.type === "deal" && (s.started || seat !== 0)) return { error: "Only the host can deal the first hand." };
      if (s.players < 2) return { error: "Wait for at least one friend to join." };
      if (a.type === "next" && !(s.h?.result)) return { error: "This hand isn't finished." };
      const seats = s.h ? s.h.seats : s.seats.map((x, i) => (i < s.players ? x : { ...x, chips: 0, out: true }));
      const alive = seats.filter((x) => x.chips > 0).length;
      if (alive < 2) return { error: "The game's over." };
      let dealer = s.h ? (s.dealer + 1) % 4 : 0;
      while (seats[dealer].chips <= 0) dealer = (dealer + 1) % 4;
      const h = PK.startHand(seats, dealer, s.handNo + 1, nextRand(s));
      return { s: { ...s, started: true, h, dealer, handNo: s.handNo + 1, seat: h.result ? -1 : h.turn } };
    }
    if (!s.h || s.h.result) return { error: "There's no hand on." };
    if (s.h.turn !== seat) return { error: "It's not your turn." };
    const map = { fold: { kind: "fold" }, check: { kind: "check" }, call: { kind: "call" }, raise: { kind: "raise", to: (a as { to: number }).to } } as Record<string, PK.Action>;
    const act = map[a.type];
    if (!act) return { error: "That's not a poker move." };
    if (act.kind === "check" && PK.toCall(s.h) > 0) return { error: "You need to call or fold." };
    const h = PK.act(s.h, act);
    const over = !!h.result && h.seats.filter((x) => x.chips > 0).length < 2;
    return { s: { ...s, h, seat: h.result ? -1 : h.turn, over } };
  }
  if (s.kind === "dominoes") {
    if (a.type === "next") {
      if (s.r.winner === null || s.over) return { error: "The round isn't over." };
      const r = DM.deal(nextRand(s), s.r.winner);
      return { s: { ...s, r, scored: false, seat: r.turn } };
    }
    if (s.r.winner !== null) return { error: "The round's over." };
    if (s.r.turn !== seat) return { error: "It's not your turn." };
    let r: DM.Round | null;
    if (a.type === "play") r = DM.play(s.r, a.tile, a.end);
    else if (a.type === "draw") { if (DM.canPlay(s.r, seat as 0 | 1)) return { error: "You can play a tile, so you can't draw." }; r = DM.drawOrPass(s.r); }
    else return { error: "That's not a dominoes move." };
    if (!r) return { error: "That tile doesn't fit there." };
    let match = s.match, over = false, scored = s.scored;
    if (r.winner !== null && !scored) { match = [...s.match] as [number, number]; match[r.winner] += DM.roundPoints(r); scored = true; over = match[r.winner] >= DM.TARGET; }
    return { s: { ...s, r, match, scored, over, seat: r.winner !== null ? -1 : r.turn } };
  }
  // Café letters
  if (s.g.over) return { error: "The game's over." };
  if (s.g.turn !== seat) return { error: "It's not your turn." };
  let g: CL.Game | { why: string };
  if (a.type === "word") g = CL.playMove(s.g, a.move);
  else if (a.type === "pass") g = CL.passOrSwap(s.g, s.g.bag.length >= CL.RACK ? a.swap : [], nextRand(s));
  else return { error: "That's not a letters move." };
  if ("why" in g) return { error: g.why };
  return { s: { ...s, g, over: g.over, seat: g.over ? -1 : g.turn } };
}

/** What one seat is allowed to see: their own hand, the table, and only counts for everyone else's */
export function view(s: RoomState, seat: number | null) {
  if (s.kind === "poker") {
    const h = s.h;
    const showAll = !!h?.result && h.street === "showdown";
    return { ...s, seed: 0, seats: undefined, h: h ? { ...h, deck: [], seats: h.seats.map((x, i) => ({ ...x, cards: i === seat || (showAll && !x.folded && !x.out) ? x.cards : x.cards.map(() => null) })) } : null };
  }
  if (s.kind === "dominoes") return { ...s, seed: 0, r: { ...s.r, boneyard: s.r.boneyard.map(() => null), hands: s.r.hands.map((hand, i) => (i === seat || s.r.winner !== null ? hand : hand.map(() => null))) } };
  return { ...s, seed: 0, g: { ...s.g, bag: s.g.bag.map(() => null), racks: s.g.racks.map((r, i) => (i === seat || s.g.over ? r : r.map(() => null))) } };
}
