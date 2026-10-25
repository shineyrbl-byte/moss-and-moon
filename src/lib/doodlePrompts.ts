// Doodle of the day: a drawing prompt for the doodle wall. Pure, so the page, server and tests share it.
import { seededRand } from "./gameOrders.ts";

export const DOODLE_PROMPTS = [
  "Your dream cup", "A cat in the rain", "The moon having a coffee", "Your favourite plant", "A croissant with a face",
  "The view from your window", "A dog at the beach", "Your perfect breakfast", "A coffee bean on holiday", "The monsoon",
  "A sleepy barista", "Something that makes you happy", "A teapot family", "Your hometown", "A fish riding a bicycle",
  "Your favourite book cover, from memory", "A mango with sunglasses", "A cosy corner", "The sun setting over the sea", "A tiny house in a mug",
  "Your pet (or a pet you'd like)", "A robot making latte art", "A rainy Panjim street", "A cake for someone you love", "A night sky",
  "Your shoes today", "A cup of chai having a bad day", "A garden on the moon", "Your best friend as a dessert", "A boat on the Mandovi",
  "Something you lost once", "A dragon who only drinks tea", "The weather inside your head", "A hammock between two palms", "A biscuit dunked too long",
  "A monster who's actually very kind", "Your favourite song as a picture", "A snail in a hurry", "A lighthouse", "Your coffee order as a person",
];
const day = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400_000);
/** Today's prompt: the list shuffled once, then one a day */
export function promptFor(date: string) {
  const rand = seededRand("moss-moon-doodle");
  const order = [...DOODLE_PROMPTS];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return order[((day(date) % order.length) + order.length) % order.length];
}
