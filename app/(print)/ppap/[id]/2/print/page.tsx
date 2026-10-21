import PpapElementPrintPage from "../../[element]/print/page";

/**
 * The static `(app)/ppap/[id]/2/[ecnId]` segment outranks the dynamic
 * `[element]` one, so without this route `/ppap/[id]/2/print` resolves to the
 * ECN detail page with ecnId "print" (404). A static `print` beats `[ecnId]`.
 */
export default async function EcnPrintRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PpapElementPrintPage params={Promise.resolve({ id, element: "2" })} />;
}
