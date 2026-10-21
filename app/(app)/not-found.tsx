import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/**
 * Shown for unknown records and for pages the signed-in role may not open
 * (permission guards call notFound() so a customer login can't probe for
 * other customers' PPAPs). Rendered inside the app shell.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-24 text-center" data-testid="not-found">
      <span className="grid size-12 place-items-center rounded-xl bg-secondary text-muted-foreground">
        <FileQuestion className="size-6" aria-hidden />
      </span>
      <h1 className="text-lg font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-muted-foreground">This page doesn&apos;t exist, or your login doesn&apos;t have access to it.</p>
      <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
        Back to dashboard
      </Link>
    </main>
  );
}
