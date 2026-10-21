import { PPAP_ELEMENT_NAMES } from "@/lib/constants/ppap-elements";
import { formatDateIndia } from "@/lib/format";
import { StatusBadge, ApplicabilityBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Prisma } from "@/app/generated/prisma/client";

type PpapElementWithSignatures = Prisma.PpapElementGetPayload<{
  include: { preparedBy: true; checkedBy: true; approvedBy: true };
}>;

export function GenericElementPlaceholder({ ppapElement }: { ppapElement: PpapElementWithSignatures }) {
  const { elementNo } = ppapElement;
  return (
    <main className="mx-auto max-w-3xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {elementNo}. {PPAP_ELEMENT_NAMES[elementNo]}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <ApplicabilityBadge applicability={ppapElement.applicability} />
            <StatusBadge status={ppapElement.status} />
            {ppapElement.revisionRequired ? <Badge variant="destructive">Revision required</Badge> : null}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Doc No.</dt>
            <dd>{ppapElement.docNo ?? "—"}</dd>
            <dt className="text-muted-foreground">Revision</dt>
            <dd>{ppapElement.revision}</dd>
            {ppapElement.naReason ? (
              <>
                <dt className="text-muted-foreground">N/A reason</dt>
                <dd>{ppapElement.naReason}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">Prepared by</dt>
            <dd>
              {ppapElement.preparedBy?.name ?? "—"}
              {ppapElement.preparedAt ? ` · ${formatDateIndia(ppapElement.preparedAt)}` : ""}
            </dd>
            <dt className="text-muted-foreground">Checked by</dt>
            <dd>
              {ppapElement.checkedBy?.name ?? "—"}
              {ppapElement.checkedAt ? ` · ${formatDateIndia(ppapElement.checkedAt)}` : ""}
            </dd>
            <dt className="text-muted-foreground">Approved by</dt>
            <dd>
              {ppapElement.approvedBy?.name ?? "—"}
              {ppapElement.approvedAt ? ` · ${formatDateIndia(ppapElement.approvedAt)}` : ""}
            </dd>
          </dl>

          <p className="border-t pt-4 text-sm text-muted-foreground">
            The form, print view, and Excel/PDF export for this page will be built in a later
            session, per CLAUDE.md&apos;s per-element page conventions.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
