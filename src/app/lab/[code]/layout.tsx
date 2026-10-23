import type { Metadata } from "next";
import { getCreation } from "@/lib/lab";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const c = getCreation((await params).code);
  return c ? { title: `${c.name} by ${c.creator}`, description: `A ${c.baseName}, ${c.describe || "as it comes"}. Made in the Moss & Moon drink lab.` } : { title: "Drink lab" };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
