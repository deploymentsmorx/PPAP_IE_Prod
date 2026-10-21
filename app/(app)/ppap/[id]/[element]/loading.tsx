import { Skeleton } from "@/components/ui/skeleton";

/** Element-page placeholder: the PPAP header and element sidebar stay, only the page body waits. */
export default function Loading() {
  return (
    <div className="space-y-5 p-6" role="status" aria-label="Loading">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>
      <Skeleton className="h-28 rounded-xl" />
      <div className="space-y-2 rounded-xl border bg-card p-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-8" style={{ opacity: 1 - i * 0.09 }} />
        ))}
      </div>
    </div>
  );
}
