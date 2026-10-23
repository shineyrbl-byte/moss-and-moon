import type { Metadata } from "next";

export const metadata: Metadata = { title: "Song requests", description: "Ask for a song at Moss & Moon. Staff approve it, and the TV shows what's playing and what's next." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
