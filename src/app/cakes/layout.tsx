import type { Metadata } from "next";

export const metadata: Metadata = { title: "Whole cakes", description: "Order a whole cake from Moss & Moon two days ahead, with your message on top." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
