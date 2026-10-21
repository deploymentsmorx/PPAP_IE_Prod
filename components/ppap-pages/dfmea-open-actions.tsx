import { formatDateIndia } from "@/lib/format";
import { calculateRpn } from "@/lib/calc/fmea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Prisma } from "@/app/generated/prisma/client";

type Row = Prisma.DfmeaRowGetPayload<{ include: { responsible: true } }>;

export function DfmeaOpenActions({ rows }: { rows: Row[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const openRows = rows.filter((r) => r.recommendedActions && !r.actionTaken);

  if (openRows.length === 0) return null;

  return (
    <div className="mt-6 border-t pt-4">
      <h3 className="mb-2 text-sm font-semibold">Open Actions</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Recommended Action</TableHead>
            <TableHead>RPN</TableHead>
            <TableHead>Responsibility</TableHead>
            <TableHead>Target Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {openRows.map((row) => {
            const rpn =
              row.severity && row.occurrence && row.detection
                ? calculateRpn(row.severity, row.occurrence, row.detection)
                : null;
            const overdue = row.targetDate ? new Date(row.targetDate) < today : false;
            return (
              <TableRow key={row.id} className={overdue ? "bg-destructive/10" : undefined}>
                <TableCell>{row.item || "—"}</TableCell>
                <TableCell>{row.recommendedActions}</TableCell>
                <TableCell>{rpn ?? "—"}</TableCell>
                <TableCell>{row.responsible?.name ?? "—"}</TableCell>
                <TableCell>
                  {row.targetDate ? formatDateIndia(row.targetDate) : "—"}
                  {overdue ? (
                    <Badge variant="destructive" className="ml-2">
                      Overdue
                    </Badge>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
