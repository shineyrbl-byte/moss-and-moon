import type { Metadata } from "next";

export const metadata: Metadata = { title: "Café map", description: "Where the tables are at Moss & Moon, and which ones have a power socket, a window, quiet or room for dogs." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
