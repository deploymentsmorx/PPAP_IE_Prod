import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PPAP_ELEMENT_NAMES } from "@/lib/constants/ppap-elements";
import { formatDateIndia } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge, ApplicabilityBadge } from "@/components/status-badge";
import { SignatureBlock } from "@/components/signature-block";
import { NaToggle } from "@/components/na-toggle";
import { DeleteEcnButton } from "@/components/ppap-pages/delete-ecn-button";

const ECN_STATUS_VARIANT: Record<string, "secondary" | "default" | "outline"> = {
  DRAFT: "secondary",
  REVIEWED: "outline",
  APPROVED: "default",
};

export async function EcnRecordPage({ ppapId }: { ppapId: string }) {
  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 2 } },
  });

  const ecns = await prisma.ecnRecord.findMany({
    where: { ppapElementId: element.id },
    orderBy: { createdAt: "desc" },
  });

  const users = await prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  const locked = element.status === "APPROVED";
  const noChangeEnabled = element.applicability === "NA" && ecns.length === 0;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>2. ECN Record</CardTitle>
          <div className="flex items-center gap-2">
            <ApplicabilityBadge applicability={element.applicability} />
            <StatusBadge status={element.status} />
            <Button
              render={<Link href={`/ppap/${ppapId}/2/print`} target="_blank" />}
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              Print
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <NaToggle
            ppapElementId={element.id}
            label="No engineering change — initial submission"
            defaultReason="No engineering change – initial submission"
            initialEnabled={element.applicability === "NA"}
            initialReason={element.naReason ?? "Rev. H is the initial submission"}
            locked={locked}
          />

          {!noChangeEnabled || ecns.length > 0 ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">ECN Log</h3>
                {!locked ? (
                  <Button render={<Link href={`/ppap/${ppapId}/2/new`} />} nativeButton={false} size="sm">
                    Add ECN
                  </Button>
                ) : null}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ECN No.</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Stock Disposition</TableHead>
                    <TableHead>Affected Elements</TableHead>
                    <TableHead>Status</TableHead>
                    {!locked ? <TableHead className="w-32">Actions</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ecns.map((ecn) => (
                    <TableRow key={ecn.id}>
                      <TableCell>
                        <Link href={`/ppap/${ppapId}/2/${ecn.id}`} className="hover:underline">
                          {ecn.ecnNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{ecn.ecnDate ? formatDateIndia(ecn.ecnDate) : "—"}</TableCell>
                      <TableCell>{ecn.changeType ?? "—"}</TableCell>
                      <TableCell>{ecn.department ?? "—"}</TableCell>
                      <TableCell>{ecn.stockDisposition ?? "—"}</TableCell>
                      <TableCell>
                        {ecn.affectedElementNos.length
                          ? ecn.affectedElementNos.map((n) => PPAP_ELEMENT_NAMES[n]).join(", ")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ECN_STATUS_VARIANT[ecn.status]}>{ecn.status}</Badge>
                      </TableCell>
                      {!locked ? (
                        <TableCell>
                          <DeleteEcnButton ecnId={ecn.id} ppapElementId={element.id} />
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                  {ecns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={locked ? 7 : 8} className="text-center text-muted-foreground">
                        No ECNs logged yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </>
          ) : null}

          <SignatureBlock
            ppapElementId={element.id}
            stages={["PREPARED", "CHECKED", "APPROVED"]}
            status={element.status}
            users={users}
            prepared={{ byId: element.preparedById, at: element.preparedAt }}
            checked={{ byId: element.checkedById, at: element.checkedAt }}
            approved={{ byId: element.approvedById, at: element.approvedAt }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
