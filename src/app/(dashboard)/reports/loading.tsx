import { Skeleton } from "@/components/shared/skeleton";

export default function ReportsLoading() {
  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-background px-6 py-3.5">
        <div>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-2 h-3 w-40" />
        </div>
      </header>

      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-56 w-full rounded-lg" />
      </div>
    </>
  );
}
