import { EcnDetailPage } from "@/components/ppap-pages/ecn-detail-page";

export default async function EcnDetailRoute({
  params,
}: {
  params: Promise<{ id: string; ecnId: string }>;
}) {
  const { id, ecnId } = await params;
  return <EcnDetailPage ppapId={id} ecnId={ecnId} />;
}
