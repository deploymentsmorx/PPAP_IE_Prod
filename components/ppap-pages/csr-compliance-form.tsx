"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCsrCompliance, uploadCsrEvidence } from "@/lib/actions/csr";
import { PPAP_ELEMENT_NAMES } from "@/lib/constants/ppap-elements";
import { submitFormData } from "@/lib/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Row = {
  requirementId: string;
  ruleNo: number;
  text: string;
  compliance: {
    id: string;
    complied: boolean | null;
    evidenceElementNo: number | null;
    evidenceFileUrl: string | null;
    evidenceFileName: string | null;
    remark: string | null;
  };
};
type Section = { id: string; code: string; title: string; description: string | null; colour: string | null; rows: Row[] };

export function ComplianceStatusBadge({ complied }: { complied: boolean | null }) {
  if (complied === true) return <Badge className="border-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" variant="outline">Complied</Badge>;
  if (complied === false) return <Badge variant="destructive">Not complied</Badge>;
  return <Badge variant="outline" className="border-0 bg-muted">Not assessed</Badge>;
}

/** Compliance checklist: one row per CSR requirement — complied Y/N, evidence (element link and/or file), remark. */
export function CsrComplianceForm({ ppapId, ppapElementId, locked, sections }: { ppapId: string; ppapElementId: string; locked: boolean; sections: Section[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      onSubmit={submitFormData((formData) => {
        setMessage(null);
        startTransition(async () => {
          try {
            await saveCsrCompliance(ppapElementId, formData);
            setMessage("Saved.");
            router.refresh();
          } catch (err) {
            setMessage(err instanceof Error ? err.message : "Could not save.");
          }
        });
      })}
      className="space-y-4"
    >
      {sections.map((s) => (
        <section key={s.id} className="space-y-1" data-testid={`csr-section-${s.code}`}>
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded text-white" style={{ backgroundColor: s.colour ?? "#6b7280" }}>
              {s.code}
            </span>
            {s.title}
            {s.description ? <span className="font-normal text-muted-foreground">— {s.description}</span> : null}
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="w-8 p-1">#</th>
                  <th className="p-1">Requirement</th>
                  <th className="w-32 p-1">Complied</th>
                  <th className="w-56 p-1">Evidence</th>
                  <th className="w-56 p-1">Remark</th>
                </tr>
              </thead>
              <tbody>
                {s.rows.map((r) => (
                  <tr key={r.requirementId} className="border-b align-top" data-testid="csr-requirement">
                    <td className="p-1 pt-2 text-muted-foreground">{r.ruleNo}</td>
                    <td className="p-1 pt-2">{r.text}</td>
                    <td className="space-y-1 p-1">
                      <ComplianceStatusBadge complied={r.compliance.complied} />
                      <select
                        name={`cmp-${r.compliance.id}-complied`}
                        aria-label={`${s.code}${r.ruleNo} complied`}
                        defaultValue={r.compliance.complied === true ? "Y" : r.compliance.complied === false ? "N" : ""}
                        disabled={locked}
                        className="h-8 w-full rounded-md border bg-transparent px-2 text-sm"
                      >
                        <option value="">— Not assessed —</option>
                        <option value="Y">Y — Complied</option>
                        <option value="N">N — Not complied</option>
                      </select>
                    </td>
                    <td className="space-y-1 p-1">
                      <select
                        name={`cmp-${r.compliance.id}-evidenceElementNo`}
                        aria-label={`${s.code}${r.ruleNo} evidence element`}
                        defaultValue={r.compliance.evidenceElementNo?.toString() ?? ""}
                        disabled={locked}
                        className="h-8 w-full rounded-md border bg-transparent px-2 text-sm"
                      >
                        <option value="">— No element link —</option>
                        {Object.entries(PPAP_ELEMENT_NAMES).map(([n, name]) => (
                          <option key={n} value={n}>
                            {n}. {name}
                          </option>
                        ))}
                      </select>
                      {r.compliance.evidenceElementNo != null ? (
                        <Link href={`/ppap/${ppapId}/${r.compliance.evidenceElementNo}`} className="block text-xs text-primary hover:underline">
                          Open {r.compliance.evidenceElementNo}. {PPAP_ELEMENT_NAMES[r.compliance.evidenceElementNo]}
                        </Link>
                      ) : null}
                      {r.compliance.evidenceFileUrl ? (
                        <a href={r.compliance.evidenceFileUrl} target="_blank" rel="noreferrer" className="block text-xs text-primary underline">
                          {r.compliance.evidenceFileName ?? "evidence"}
                        </a>
                      ) : null}
                      {!locked ? <EvidenceUpload complianceId={r.compliance.id} ppapElementId={ppapElementId} label={`${s.code}${r.ruleNo}`} /> : null}
                    </td>
                    <td className="p-1">
                      <Input name={`cmp-${r.compliance.id}-remark`} aria-label={`${s.code}${r.ruleNo} remark`} defaultValue={r.compliance.remark ?? ""} disabled={locked} className="h-8" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {!locked ? (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save compliance"}
          </Button>
          {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
        </div>
      ) : null}
    </form>
  );
}

function EvidenceUpload({ complianceId, ppapElementId, label }: { complianceId: string; ppapElementId: string; label: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-1">
      <input ref={ref} type="file" aria-label={`${label} evidence file`} className="w-32 text-[11px]" />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs"
        disabled={isPending}
        onClick={() => {
          const file = ref.current?.files?.[0];
          if (!file) return;
          const fd = new FormData();
          fd.append("file", file);
          startTransition(async () => {
            await uploadCsrEvidence(complianceId, ppapElementId, fd);
            if (ref.current) ref.current.value = "";
            router.refresh();
          });
        }}
      >
        Attach
      </Button>
    </div>
  );
}
