import { Skeleton } from "@/components/shared/skeleton";

export default function LeadsLoading() {
  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-background px-6 py-3.5">
        <div>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-2 h-3 w-24" />
        </div>
      </header>

      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-80" />
          <Skeleton className="h-8 w-56" />
        </div>

        <div className="card-surface overflow-hidden rounded-xl border border-border bg-card">
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="ml-auto h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
