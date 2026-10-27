import type { Metadata } from "next";

export const metadata: Metadata = { title: "What's new", description: "The latest things to try at Moss & Moon: new games, features and dishes." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
