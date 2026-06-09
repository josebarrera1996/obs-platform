import { MainLayout } from "@/components/MainLayout";
import { Skeleton } from "@/components/Skeleton";

export default function ServiceLoading() {
  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <Skeleton className="h-4 w-24 mb-3" />
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>

        {/* Resource metrics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>

        {/* Charts */}
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />

        {/* Table */}
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </MainLayout>
  );
}
