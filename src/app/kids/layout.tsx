import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kids' corner", description: "The kids' menu, colouring pages, I spy and easy games for little ones at Moss & Moon." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
