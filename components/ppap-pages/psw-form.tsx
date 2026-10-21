"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePsw, signPsw, withdrawPswSignature } from "@/lib/actions/psw";
import { PSW_REASONS, PSW_LEVELS, pswDeclaration, type ResultTick } from "@/lib/calc/psw";
import { PPAP_ELEMENT_NAMES } from "@/lib/constants/ppap-elements";
import { formatDateIndia } from "@/lib/format";
import { submitFormData } from "@/lib/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Detail = {
  safetyGovRegulation: boolean | null;
  poNumber: string | null;
  checkingAidEcl: string | null;
  checkingAidEclDate: Date | null;
  submittalDimensional: boolean;
  submittalMaterials: boolean;
  submittalAppearance: boolean;
  otherReasonText: string | null;
  resultsMeetRequirements: boolean | null;
  explanation: string | null;
  productionRateQty: string | null;
  productionRateHours: string | null;
  printName: string | null;
  title: string | null;
  phone: string | null;
  signedAt: Date | null;
  signedByName: string | null;
  signedBySignatureUrl: string | null;
} | null;

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");

function Tick({ value, label, href }: { value: ResultTick; label: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-1.5 hover:underline" data-testid={`result-${label}`} data-value={value}>
      <span className={value === "YES" ? "text-emerald-600" : "text-muted-foreground"}>{value === "YES" ? "☑" : value === "NA" ? "⊘" : "☐"}</span>
      {label}
      {value === "NA" ? <span className="text-xs text-muted-foreground">(N/A)</span> : null}
    </Link>
  );
}

export function PswForm({
  ppapId,
  ppapElementId,
  closed,
  disposed,
  detail,
  defaults,
  auto,
  level,
  results,
  missing,
  checkErrors,
}: {
  /** Pre-submission data-check errors (shown above the form) — they block signing too. */
  checkErrors: number;
  ppapId: string;
  ppapElementId: string;
  closed: boolean;
  /** The customer has dispositioned this signature — it can't be withdrawn. */
  disposed: boolean;
  detail: Detail;
  defaults: { reasons: string[]; checkingAidNo: string | null; printName: string | null; title: string | null };
  auto: {
    partName: string;
    customerPartNumber: string;
    ecl: string;
    eclDate: Date | null;
    drawingNo: string;
    weightKg: number | null;
    additionalChanges: { id: string; ecnNumber: string; ecnDate: Date | null }[];
    supplier: { name: string; code: string | null; street: string | null; city: string | null; stateCountry: string | null; zip: string | null };
    submission: { customerDivision: string; buyer: string | null; application: string | null };
  };
  level: number;
  results: Record<"dimensional" | "materialFunctional" | "appearance" | "statistical", ResultTick>;
  missing: { elementNo: number; status: string }[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>(defaults.reasons);
  const [meets, setMeets] = useState<string>(detail?.resultsMeetRequirements === true ? "Y" : detail?.resultsMeetRequirements === false ? "N" : "");
  const [rateQty, setRateQty] = useState(detail?.productionRateQty ?? "");
  const [rateHours, setRateHours] = useState(detail?.productionRateHours ?? "");
  const signed = !!detail?.signedAt;
  const locked = closed || signed;
  const ready = missing.length === 0;

  function run(action: () => Promise<unknown>, done: string) {
    setMessage(null);
    startTransition(async () => {
      try {
        await action();
        setMessage(done);
        router.refresh();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={submitFormData((fd) => run(() => savePsw(ppapElementId, fd), "Saved."))} className="space-y-5">
      {/* Part information */}
      <section className="space-y-2 rounded-md border p-3">
        <h3 className="text-sm font-semibold">Part Information</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm md:grid-cols-4">
          <dt className="text-muted-foreground">Part Name</dt>
          <dd>{auto.partName}</dd>
          <dt className="text-muted-foreground">Customer Part Number</dt>
          <dd>{auto.customerPartNumber}</dd>
          <dt className="text-muted-foreground">Engineering Drawing Change Level</dt>
          <dd>
            {auto.ecl} — dated {formatDateIndia(auto.eclDate)}
          </dd>
          <dt className="text-muted-foreground">Additional Engineering Changes</dt>
          <dd data-testid="additional-changes">
            {auto.additionalChanges.length
              ? auto.additionalChanges.map((c) => `${c.ecnNumber} (${formatDateIndia(c.ecnDate)})`).join(", ")
              : "-"}
          </dd>
          <dt className="text-muted-foreground">Shown on Drawing Number</dt>
          <dd>{auto.drawingNo}</dd>
          <dt className="text-muted-foreground">Weight (kg)</dt>
          <dd>{auto.weightKg ?? "—"}</dd>
        </dl>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <fieldset className="space-y-1" disabled={locked}>
            <legend className="text-sm font-medium">Safety and/or Government Regulation</legend>
            <div className="flex gap-3 text-sm">
              {[
                ["Y", "Yes"],
                ["N", "No"],
              ].map(([v, l]) => (
                <label key={v} className="flex items-center gap-1">
                  <input type="radio" name="safetyGovRegulation" value={v} defaultChecked={(detail?.safetyGovRegulation === true && v === "Y") || (detail?.safetyGovRegulation === false && v === "N")} />
                  {l}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-1">
            <Label htmlFor="psw-poNumber">Purchase Order No.</Label>
            <Input id="psw-poNumber" name="poNumber" defaultValue={detail?.poNumber ?? ""} disabled={locked} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="psw-checkingAidNo">Checking Aid Number</Label>
            <Input id="psw-checkingAidNo" name="checkingAidNo" defaultValue={defaults.checkingAidNo ?? ""} disabled={locked} placeholder="- (none)" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="psw-checkingAidEcl">Checking Aid Eng. Change Level</Label>
            <Input id="psw-checkingAidEcl" name="checkingAidEcl" defaultValue={detail?.checkingAidEcl ?? ""} disabled={locked} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="psw-checkingAidEclDate">Dated</Label>
            <Input id="psw-checkingAidEclDate" name="checkingAidEclDate" type="date" defaultValue={iso(detail?.checkingAidEclDate)} disabled={locked} />
          </div>
        </div>
      </section>

      {/* Supplier manufacturing / submission information */}
      <section className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1 rounded-md border p-3 text-sm">
          <h3 className="font-semibold">Supplier Manufacturing Information</h3>
          <p>
            {auto.supplier.name}
            {auto.supplier.code ? ` — Supplier code ${auto.supplier.code}` : ""}
          </p>
          <p>{auto.supplier.street ?? "—"}</p>
          <p>
            {[auto.supplier.city, auto.supplier.stateCountry, auto.supplier.zip].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <div className="space-y-1 rounded-md border p-3 text-sm">
          <h3 className="font-semibold">Submission Information</h3>
          <p>Customer Name/Division: {auto.submission.customerDivision}</p>
          <p>Buyer/Buyer Code: {auto.submission.buyer ?? "-"}</p>
          <p>Application: {auto.submission.application ?? "-"}</p>
          <fieldset className="flex flex-wrap gap-3 pt-1" disabled={locked}>
            <legend className="sr-only">Customer submittal information</legend>
            <label className="flex items-center gap-1">
              <input type="checkbox" name="submittalDimensional" defaultChecked={detail?.submittalDimensional ?? true} /> Dimensional
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" name="submittalMaterials" defaultChecked={detail?.submittalMaterials ?? true} /> Materials/Function
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" name="submittalAppearance" defaultChecked={detail?.submittalAppearance ?? true} /> Appearance
            </label>
          </fieldset>
        </div>
      </section>

      {/* Reason for submission */}
      <fieldset className="space-y-2 rounded-md border p-3" disabled={locked}>
        <legend className="px-1 text-sm font-semibold">Reason for Submission</legend>
        <div className="grid gap-1 text-sm md:grid-cols-2">
          {PSW_REASONS.map((r) => (
            <label key={r.code} className="flex items-center gap-2">
              <input
                type="checkbox"
                name="reasons"
                value={r.code}
                checked={reasons.includes(r.code)}
                onChange={(e) => setReasons((prev) => (e.target.checked ? [...prev, r.code] : prev.filter((x) => x !== r.code)))}
              />
              {r.label}
            </label>
          ))}
        </div>
        {reasons.includes("OTHER") ? <Input name="otherReasonText" aria-label="Other reason" defaultValue={detail?.otherReasonText ?? ""} placeholder="Please specify" className="max-w-lg" /> : null}
      </fieldset>

      {/* Requested submission level */}
      <section className="space-y-1 rounded-md border p-3 text-sm">
        <h3 className="font-semibold">Requested Submission Level</h3>
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className={n === level ? "font-medium" : "text-muted-foreground"}>
            {n === level ? "☑" : "☐"} {PSW_LEVELS[n]}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">From the PPAP&apos;s level.</p>
      </section>

      {/* Submission results */}
      <section className="space-y-2 rounded-md border p-3 text-sm">
        <h3 className="font-semibold">Submission Results</h3>
        <div className="flex flex-wrap items-center gap-4">
          <span>The results for</span>
          <Tick value={results.dimensional} label="dimensional measurements" href={`/ppap/${ppapId}/9`} />
          <Tick value={results.materialFunctional} label="material and functional tests" href={`/ppap/${ppapId}/10`} />
          <Tick value={results.appearance} label="appearance criteria" href={`/ppap/${ppapId}/13`} />
          <Tick value={results.statistical} label="statistical process package" href={`/ppap/${ppapId}/11`} />
        </div>
        <p className="text-xs text-muted-foreground">Ticked automatically when 9, 10 &amp; 12, 13 and 11 are approved.</p>
        <fieldset className="flex flex-wrap items-center gap-3" disabled={locked}>
          <legend className="sr-only">Results meet requirements</legend>
          <span>These results meet all drawing and specification requirements:</span>
          {[
            ["Y", "Yes"],
            ["N", "No"],
          ].map(([v, l]) => (
            <label key={v} className="flex items-center gap-1">
              <input type="radio" name="resultsMeetRequirements" value={v} checked={meets === v} onChange={() => setMeets(v)} />
              {l}
            </label>
          ))}
          <span className="text-xs text-muted-foreground">(If &quot;NO&quot; — explanation required)</span>
        </fieldset>
      </section>

      {/* Declaration */}
      <section className="space-y-2 rounded-md border p-3 text-sm">
        <h3 className="font-semibold">Declaration</h3>
        <p>{pswDeclaration(rateQty || null, rateHours || null)}</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="psw-rateQty">Production rate (parts)</Label>
            <Input id="psw-rateQty" name="productionRateQty" value={rateQty} onChange={(e) => setRateQty(e.target.value)} disabled={locked} className="w-28" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="psw-rateHours">per (hours)</Label>
            <Input id="psw-rateHours" name="productionRateHours" value={rateHours} onChange={(e) => setRateHours(e.target.value)} disabled={locked} className="w-28" />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="psw-explanation">
            Explanation/Comments {meets === "N" ? <span className="text-destructive">— required (results answered No)</span> : null}
          </Label>
          <Textarea id="psw-explanation" name="explanation" defaultValue={detail?.explanation ?? ""} disabled={locked} required={meets === "N"} />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="psw-printName">Print Name</Label>
            <Input id="psw-printName" name="printName" defaultValue={detail?.printName ?? defaults.printName ?? ""} disabled={locked} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="psw-title">Title</Label>
            <Input id="psw-title" name="title" defaultValue={detail?.title ?? defaults.title ?? ""} disabled={locked} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="psw-phone">Phone No.</Label>
            <Input id="psw-phone" name="phone" defaultValue={detail?.phone ?? ""} disabled={locked} />
          </div>
        </div>
      </section>

      {/* Supplier authorised signature + readiness gate */}
      <section className="space-y-2 rounded-md border p-3 text-sm" data-testid="psw-signature">
        <h3 className="font-semibold">Supplier Authorized Signature</h3>
        {signed ? (
          <div className="flex flex-wrap items-center gap-3" data-testid="psw-signed">
            {detail?.signedBySignatureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail.signedBySignatureUrl} alt="Signature" className="h-10" />
            ) : null}
            <span>
              E-signed by <strong>{detail?.signedByName}</strong> on {formatDateIndia(detail?.signedAt)}
            </span>
            {!closed && !disposed ? (
              <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={() => run(() => withdrawPswSignature(ppapElementId), "Signature withdrawn.")}>
                Withdraw signature
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            {!ready ? (
              <div className="rounded bg-amber-50 p-2 text-amber-900 dark:bg-amber-950 dark:text-amber-200" data-testid="psw-gate">
                <p className="font-medium">Can&apos;t sign yet — {missing.length} required element(s) not approved:</p>
                <ul className="mt-1 list-inside list-disc">
                  {missing.map((m) => (
                    <li key={m.elementNo}>
                      <Link href={`/ppap/${ppapId}/${m.elementNo}`} className="underline">
                        {m.elementNo}. {PPAP_ELEMENT_NAMES[m.elementNo]}
                      </Link>{" "}
                      <span className="text-xs">({m.status.toLowerCase().replace(/_/g, " ")})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : checkErrors > 0 ? (
              <p className="text-red-700 dark:text-red-400" data-testid="psw-check-errors">
                Every required element is approved, but {checkErrors} data-check error(s) above must be fixed before signing.
              </p>
            ) : (
              <p className="text-emerald-700 dark:text-emerald-400" data-testid="psw-ready">
                Every required element is approved — ready to sign.
              </p>
            )}
            <Button
              type="button"
              disabled={!ready || checkErrors > 0 || isPending || closed}
              onClick={() => {
                const fd = new FormData(formRef.current!);
                run(async () => {
                  await savePsw(ppapElementId, fd);
                  await signPsw(ppapElementId);
                }, "PSW signed and submitted.");
              }}
            >
              Sign PSW
            </Button>
          </>
        )}
      </section>

      {!locked ? (
        <div className="flex items-center gap-3">
          <Button type="submit" variant="outline" disabled={isPending}>
            {isPending ? "Saving..." : "Save PSW"}
          </Button>
        </div>
      ) : null}
      {message ? <p className="text-sm text-muted-foreground" data-testid="psw-message">{message}</p> : null}
    </form>
  );
}
