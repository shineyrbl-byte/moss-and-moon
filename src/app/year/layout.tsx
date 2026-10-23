import type { Metadata } from "next";

export const metadata: Metadata = { title: "Your year at Moss & Moon", description: "Your last 12 months in coffee: visits, favourites, streaks and badges, with a card to share.", robots: { index: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
