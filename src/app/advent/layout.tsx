import type { Metadata } from "next";

export const metadata: Metadata = { title: "Advent calendar", description: "A door a day from 1 to 24 December, each with a little treat from Moss & Moon." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
