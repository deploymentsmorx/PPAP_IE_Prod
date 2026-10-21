import { prisma } from "@/lib/prisma";
import { formatDateIndia } from "@/lib/format";
import { PrintHeader } from "@/components/print-header";
import { PrintFooter } from "@/components/print-footer";
import { PPAP_ELEMENT_NAMES } from "@/lib/constants/ppap-elements";

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <tr>
      <td className="w-56 border border-black p-2 font-medium">{label}</td>
      <td className="border border-black p-2">{value || "-"}</td>
    </tr>
  );
}

function SectionTable({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="bg-muted/40 p-1 text-xs font-semibold">{title}</div>
      <table className="w-full border-collapse border border-black text-xs">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export async function CeaPrint({ ppapId }: { ppapId: string }) {
  const ppap = await prisma.ppap.findUniqueOrThrow({
    where: { id: ppapId },
    include: { customer: true, partRevision: { include: { part: true } } },
  });

  const element = await prisma.ppapElement.findUniqueOrThrow({
    where: { ppapId_elementNo: { ppapId, elementNo: 3 } },
    include: {
      preparedBy: true,
      checkedBy: true,
      approvedBy: true,
      ceaDetail: { include: { declaredBy: true } },
      customerDisposition: true,
    },
  });

  const requiredElements = await prisma.ppapElement.findMany({
    where: { ppapId, applicability: "REQUIRED" },
    select: { elementNo: true },
    orderBy: { elementNo: "asc" },
  });

  const d = element.ceaDetail;

  return (
    <div className="mx-auto max-w-4xl bg-white p-6 text-black print:p-0">
      <PrintHeader
        supplierName="Ingenious Engineering"
        title="PPAP DOCUMENTS"
        subtitle="CUSTOMER ENGINEERING APPROVAL (CEA)"
        docNo={element.docNo}
        revision={element.revision}
      />

      {element.applicability === "NA" ? (
        <p className="mt-4 text-sm">N/A — {element.naReason}</p>
      ) : (
        <>
          <SectionTable title="1. Header">
            <Row label="CEA No." value={d?.ceaNo} />
            <Row label="Date" value={d?.ceaDate ? formatDateIndia(d.ceaDate) : null} />
            <Row label="Customer" value={ppap.customer.name} />
            <Row label="Supplier" value="Ingenious Engineering Pvt Ltd" />
            <Row label="Part" value={ppap.partRevision.part.partName} />
            <Row label="Part No." value={ppap.partRevision.part.partNumber} />
            <Row label="Drawing No./Rev" value={`${ppap.partRevision.drawingNo ?? "-"} / ${ppap.partRevision.revision}`} />
            <Row label="Project" value={ppap.partRevision.part.projectModel} />
          </SectionTable>

          <SectionTable title="2. Request Type">
            <Row label="Type" value={d?.requestType?.replace(/_/g, " ")} />
          </SectionTable>

          <SectionTable title="3. Change Description">
            <Row label="Existing" value={d?.existingCondition} />
            <Row label="Proposed" value={d?.proposedChange} />
            <Row label="Reason" value={d?.changeReason} />
          </SectionTable>

          <SectionTable title="4. Impact Assessment">
            <Row label="Fit" value={[d?.impactFitLevel, d?.impactFitNote].filter(Boolean).join(" — ")} />
            <Row label="Form" value={[d?.impactFormLevel, d?.impactFormNote].filter(Boolean).join(" — ")} />
            <Row label="Function" value={[d?.impactFunctionLevel, d?.impactFunctionNote].filter(Boolean).join(" — ")} />
            <Row label="Quality Risk" value={[d?.impactQualityRiskLevel, d?.impactQualityRiskNote].filter(Boolean).join(" — ")} />
            <Row label="Reliability/Life" value={[d?.impactReliabilityLevel, d?.impactReliabilityNote].filter(Boolean).join(" — ")} />
            <Row label="Regulatory/Safety" value={[d?.impactRegulatoryLevel, d?.impactRegulatoryNote].filter(Boolean).join(" — ")} />
          </SectionTable>

          <SectionTable title="5. Validation & Verification">
            <Row label="Tests Performed" value={d?.testsPerformed} />
            <Row label="Standard" value={d?.testStandard} />
            <Row label="Result Summary" value={d?.resultSummary} />
          </SectionTable>

          <SectionTable title="6. PPAP Status">
            <Row label="Level" value={String(ppap.level)} />
            <Row
              label="Documents Covered"
              value={requiredElements.length ? requiredElements.map((e) => PPAP_ELEMENT_NAMES[e.elementNo]).join(", ") : "Refer to checklist"}
            />
            <Row label="Submission Status" value={d?.submissionStatus} />
          </SectionTable>

          {d?.requestType === "DEVIATION" ? (
            <SectionTable title="7. Deviation Details">
              <Row label="Description" value={d?.deviationDescription} />
              <Row label="Quantity" value={d?.deviationQty} />
              <Row label="Validity Period" value={d?.deviationValidityPeriod} />
              <Row label="Interim Containment" value={d?.deviationInterimContainment} />
            </SectionTable>
          ) : null}

          <SectionTable title="8. Sample Information">
            <Row label="Quantity" value={d?.sampleQty} />
            <Row label="Lot No." value={d?.sampleLotNo} />
            <Row label="Submission Date" value={d?.sampleSubmissionDate ? formatDateIndia(d.sampleSubmissionDate) : null} />
          </SectionTable>

          <SectionTable title="9. Supplier Declaration">
            <Row label="Declared By" value={d?.declaredBy?.name} />
            <Row label="Designation" value={d?.declaredBy?.designation} />
            <Row label="Date" value={d?.declaredAt ? formatDateIndia(d.declaredAt) : null} />
          </SectionTable>

          <SectionTable title="10. Customer Approval">
            <Row label="Status" value={element.customerDisposition?.status} />
            <Row label="Comments" value={element.customerDisposition?.comments} />
            <Row label="Customer Name" value={element.customerDisposition?.customerName} />
            <Row label="Designation" value={element.customerDisposition?.customerDesignation} />
            <Row
              label="Date"
              value={element.customerDisposition?.customerSignatureDate ? formatDateIndia(element.customerDisposition.customerSignatureDate) : null}
            />
          </SectionTable>
        </>
      )}

      <PrintFooter
        entries={[
          { label: "Prepared By", name: element.preparedBy?.name ?? null, date: element.preparedAt },
          { label: "Checked By", name: element.checkedBy?.name ?? null, date: element.checkedAt },
          { label: "Approved By", name: element.approvedBy?.name ?? null, date: element.approvedAt },
        ]}
      />
    </div>
  );
}
