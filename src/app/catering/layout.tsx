import type { Metadata } from "next";

export const metadata: Metadata = { title: "Catering", description: "Coffee, bakes and bites from Moss & Moon for offices, birthdays and parties of 10 or more." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
