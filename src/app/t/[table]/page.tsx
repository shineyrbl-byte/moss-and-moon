import { redirect } from "next/navigation";

// Short link printed in each table's QR code: /t/5 → menu, ordering for table 5
export default async function TableLink({ params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;
  redirect(`/?table=${encodeURIComponent(table)}#menu`);
}
