import { notFound } from "next/navigation";
import { PPAP_ELEMENT_NUMBERS } from "@/lib/constants/ppap-elements";

/**
 * Validates the element number here, outside this segment's loading.tsx
 * boundary, so an unknown element returns a real 404 instead of a streamed 200.
 */
export default async function ElementLayout({ children, params }: { children: React.ReactNode; params: Promise<{ element: string }> }) {
  const elementNo = Number((await params).element);
  if (!Number.isInteger(elementNo) || !PPAP_ELEMENT_NUMBERS.includes(elementNo)) notFound();
  return children;
}
