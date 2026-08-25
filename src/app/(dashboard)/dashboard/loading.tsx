import { Skeleton } from "@/components/shared/skeleton";

export default function DashboardPageLoading() {
  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-background px-6 py-3.5">
        <div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-3 w-56" />
        </div>
      </header>

      <div className="space-y-4 p-6">
        <Skeleton className="h-16 w-full rounded-lg" />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-lg lg:col-span-2" />
          <Skeleton className="h-72 rounded-lg" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg lg:col-span-2" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-48 rounded-lg lg:col-span-2" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    </>
  );
}
