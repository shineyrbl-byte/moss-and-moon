import type { Metadata } from "next";

export const metadata: Metadata = { title: "Buy a friend a coffee", description: "Send a friend their favourite drink at Moss & Moon ☕" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
