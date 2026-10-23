import type { Metadata } from "next";

export const metadata: Metadata = { title: "Focus corner", description: "A study timer with café sounds made in your browser: rain, the milk steamer and quiet chatter." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
