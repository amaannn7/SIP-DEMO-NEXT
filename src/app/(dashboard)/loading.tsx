import { Skeleton } from "@/components/shared/skeleton";

export default function DashboardLoading() {
  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-background px-6 py-3.5">
        <div>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-48" />
        </div>
      </header>
      <div className="space-y-4 p-6">
        <Skeleton className="h-20 w-full rounded-lg" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-40 rounded-lg lg:col-span-2" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
        <Skeleton className="h-56 w-full rounded-lg" />
      </div>
    </>
  );
}
