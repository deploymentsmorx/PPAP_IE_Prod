import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/permissions";
import { getCsrLibrary } from "@/lib/csr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CsrSectionForm, CsrSectionEditToggle, CsrRequirementRow } from "@/components/csr/csr-library-forms";

/**
 * CSR library per customer (element 17) — sections and requirement rows,
 * reused by every part/PPAP of that customer.
 */
export default async function CsrLibraryPage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  await requirePagePermission("editSupplierData");
  const { customer: customerParam } = await searchParams;
  const customers = await prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const customer = customers.find((c) => c.id === customerParam) ?? customers[0];
  const sections = customer ? await getCsrLibrary(customer.id) : [];

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Customer-Specific Requirements — library</CardTitle>
          <div className="flex flex-wrap gap-2 text-sm">
            {customers.map((c) => (
              <Link
                key={c.id}
                href={`/csr?customer=${c.id}`}
                className={c.id === customer?.id ? "rounded bg-primary px-2 py-0.5 text-primary-foreground" : "rounded px-2 py-0.5 hover:bg-muted"}
              >
                {c.name}
              </Link>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Shared by every part of the selected customer. Each PPAP&apos;s 17. CSR page records compliance against these rules.
          </p>
        </CardHeader>
        {customer ? (
          <CardContent className="space-y-4">
            {sections.map((s) => (
              <section key={s.id} className="space-y-2 rounded-md border p-3" data-testid={`csr-library-${s.code}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded text-white" style={{ backgroundColor: s.colour ?? "#6b7280" }}>
                      {s.code}
                    </span>
                    {s.title}
                    {s.description ? <span className="font-normal text-muted-foreground">— {s.description}</span> : null}
                  </h3>
                  <CsrSectionEditToggle customerId={customer.id} section={s} />
                </div>
                {s.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.imageUrl} alt={s.imageName ?? `${s.title} illustration`} className="max-h-48 rounded border" />
                ) : null}
                <div className="space-y-1">
                  {s.requirements.map((r) => (
                    <CsrRequirementRow key={r.id} sectionId={s.id} requirement={r} />
                  ))}
                  <CsrRequirementRow sectionId={s.id} nextRuleNo={(s.requirements.at(-1)?.ruleNo ?? 0) + 1} />
                </div>
              </section>
            ))}
            <div className="rounded-md border p-3">
              <h3 className="mb-2 text-sm font-semibold">Add section</h3>
              <CsrSectionForm customerId={customer.id} />
            </div>
          </CardContent>
        ) : (
          <CardContent>
            <p className="text-sm text-muted-foreground">No customers yet.</p>
          </CardContent>
        )}
      </Card>
    </main>
  );
}
