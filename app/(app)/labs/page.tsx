import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/permissions";
import { formatDateIndia } from "@/lib/format";
import { isLabExpired } from "@/lib/calc/lab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LabMasterForm } from "@/components/lab-master-form";
import { LabMasterRowActions } from "@/components/lab-master-row-actions";

export default async function LabsPage() {
  await requirePagePermission("editSupplierData");
  const labs = await prisma.labMaster.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { labReports: true } } },
  });

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Lab</CardTitle>
        </CardHeader>
        <CardContent>
          <LabMasterForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Qualified Laboratories</CardTitle>
          <p className="text-sm text-muted-foreground">
            An expired lab (or one with no valid-until date) can&apos;t be selected on a new or edited lab report.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Accreditation</TableHead>
                <TableHead>Certificate No.</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Certificate</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reports</TableHead>
                <TableHead className="w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {labs.map((lab) => {
                const expired = isLabExpired(lab.validUntil);
                return (
                  <TableRow key={lab.id}>
                    <TableCell className="font-medium">{lab.name}</TableCell>
                    <TableCell>{lab.accreditationBody ?? "—"}</TableCell>
                    <TableCell>{lab.certificateNo ?? "—"}</TableCell>
                    <TableCell className="max-w-64 whitespace-normal">{lab.scope ?? "—"}</TableCell>
                    <TableCell>
                      {lab.certificatePdfUrl ? (
                        <a href={lab.certificatePdfUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                          PDF
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{formatDateIndia(lab.validUntil)}</TableCell>
                    <TableCell>
                      <Badge variant={expired ? "destructive" : "secondary"}>{expired ? "EXPIRED" : "VALID"}</Badge>
                    </TableCell>
                    <TableCell>{lab._count.labReports}</TableCell>
                    <TableCell>
                      <LabMasterRowActions lab={lab} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {labs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground">
                    No labs yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
