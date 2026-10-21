import { redirect } from "next/navigation";

export default async function PpapOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/ppap/${id}/0`);
}
