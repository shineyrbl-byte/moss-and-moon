import type { Metadata } from "next";

export const metadata: Metadata = { title: "Daily trivia", description: "One question a day about coffee, tea and Goan food. Keep a streak going." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
