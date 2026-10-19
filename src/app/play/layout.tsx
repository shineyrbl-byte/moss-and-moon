import type { Metadata } from "next";

export const metadata: Metadata = { title: "Barista rush", description: "A one-minute game: make the drinks exactly as ordered, as fast as you can." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
