import Link from "next/link";

/** Unknown URLs outside the signed-in app (no shell here). */
export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center" data-testid="not-found">
      <h1 className="text-lg font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-muted-foreground">This page doesn&apos;t exist.</p>
      <Link href="/" className="text-sm font-medium text-primary hover:underline">
        Go to the dashboard
      </Link>
    </main>
  );
}
