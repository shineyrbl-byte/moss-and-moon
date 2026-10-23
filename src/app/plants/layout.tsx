import type { Metadata } from "next";

export const metadata: Metadata = { title: "Plant corner", description: "The plants around Moss & Moon, how to look after them at home, and a board for swapping cuttings." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
