import type { Metadata } from "next";

export const metadata: Metadata = { title: "Colouring pages", description: "Colour a latte, the moon, a pup or a plant on screen, or print them for the table." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
